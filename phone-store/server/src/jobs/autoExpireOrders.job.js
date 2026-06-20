const cron = require('node-cron');
const { Order, ProductVariant, Product, FlashSale, StockLog, User, WalletTransaction, Coupon } = require('../models/index');
const logger = require('../utils/logger');

// Chạy mỗi 5 phút — tự hủy đơn pending quá hạn autoExpiry
const startAutoExpireOrdersJob = () => {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const expiredOrders = await Order.find({
        status: 'pending',
        autoExpiry: { $lt: new Date() },
      }).lean();

      if (!expiredOrders.length) return;

      for (const order of expiredOrders) {
        try {
          // Flip status TRƯỚC — idempotency guard: nếu crash sau đây, cron không retry vì đơn không còn 'pending'
          const flipped = await Order.findOneAndUpdate(
            { _id: order._id, status: 'pending' },
            { status: 'cancelled', cancelReason: 'Đơn hàng hết hạn xác nhận tự động' },
            { new: false }
          );
          if (!flipped) continue; // Đã bị cancel bởi process khác

          // Snapshot stock trước khi hoàn để StockLog có đủ dữ liệu audit
          const expireSnapMap = {};
          try {
            const expireSnaps = await ProductVariant.find(
              { _id: { $in: order.items.map((i) => i.variantId) } },
              { stock: 1 }
            ).lean();
            expireSnaps.forEach((s) => { expireSnapMap[s._id.toString()] = s.stock; });
          } catch (_) { /* snapshot thất bại không block hoàn stock */ }

          // Hoàn stock + giảm sold — dùng allSettled để lỗi 1 item không block các item khác
          const stockResults = await Promise.allSettled([
            ...order.items.map((item) =>
              ProductVariant.findByIdAndUpdate(item.variantId, { $inc: { stock: item.quantity } })
            ),
            ...order.items.map((item) =>
              Product.findByIdAndUpdate(item.productId, { $inc: { sold: -item.quantity } })
            ),
            ...order.items.map((item) => {
              if (item.flashSaleId) {
                return FlashSale.findOneAndUpdate(
                  { _id: item.flashSaleId, $expr: { $gte: ['$sold', item.quantity] } },
                  { $inc: { sold: -item.quantity } }
                );
              }
              return FlashSale.findOneAndUpdate(
                { type: { $ne: 'category' }, variantId: item.variantId, $expr: { $gte: ['$sold', item.quantity] } },
                { $inc: { sold: -item.quantity } }
              );
            }),
            ...order.items.map((item) => {
              const before = expireSnapMap[item.variantId.toString()] ?? null;
              return StockLog.create({
                variantId: item.variantId,
                productId: item.productId,
                type: 'return',
                quantity: item.quantity,
                stockBefore: before,
                stockAfter: before !== null ? before + item.quantity : null,
                note: `Đơn hết hạn tự động ${order.orderCode}`,
                orderId: order._id,
              });
            }),
          ]);
          const failed = stockResults.filter((r) => r.status === 'rejected');
          if (failed.length) {
            logger.warn(`[AutoExpire] ${failed.length} thao tác stock thất bại cho đơn ${order.orderCode}`);
          }

          // Hoàn coupon — xóa đúng 1 lần xuất hiện của userId để tránh xóa nhầm nếu user dùng nhiều lần
          if (order.couponCode) {
            await Coupon.findOneAndUpdate(
              { code: order.couponCode, usedCount: { $gt: 0 } },
              [{ $set: {
                usedCount: { $subtract: ['$usedCount', 1] },
                usedBy: {
                  $let: {
                    vars: { pos: { $indexOfArray: ['$usedBy', order.userId] } },
                    in: {
                      $cond: [
                        { $eq: ['$$pos', -1] },
                        '$usedBy',
                        { $concatArrays: [
                          { $slice: ['$usedBy', '$$pos'] },
                          { $slice: ['$usedBy', { $add: ['$$pos', 1] }, { $size: '$usedBy' }] },
                        ]},
                      ],
                    },
                  },
                },
              }}]
            );
          }

          // Hoàn tiền ví nếu đã thanh toán qua ví
          if (order.paymentMethod === 'wallet' && order.paymentStatus === 'paid') {
            const updatedUser = await User.findByIdAndUpdate(
              order.userId,
              { $inc: { walletBalance: order.totalPrice } },
              { new: true }
            ).select('walletBalance');
            if (updatedUser) {
              await WalletTransaction.create({
                userId: order.userId,
                type: 'refund',
                amount: order.totalPrice,
                balanceAfter: updatedUser.walletBalance,
                orderId: order._id,
                description: `Hoàn tiền đơn hết hạn ${order.orderCode}`,
              });
            }
          }

          // Hoàn lại điểm tích lũy đã dùng giảm giá cho đơn hết hạn tự động
          if (order.pointsUsed > 0) {
            await User.findByIdAndUpdate(order.userId, { $inc: { loyaltyPoints: order.pointsUsed } });
          }
        } catch (orderErr) {
          logger.error(`[AutoExpire] Lỗi khi xử lý đơn ${order.orderCode}: ${orderErr.message}`);
        }
      }

      logger.info(`[AutoExpire] Đã hủy ${expiredOrders.length} đơn hàng hết hạn`);
    } catch (err) {
      logger.error(`[AutoExpire] Lỗi: ${err.message}`);
    }
  });

  logger.info('[AutoExpire] Cron job khởi động — chạy mỗi 5 phút');
};

module.exports = { startAutoExpireOrdersJob };
