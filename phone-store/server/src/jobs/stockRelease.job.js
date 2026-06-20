const cron = require('node-cron');
const { Cart, ProductVariant } = require('../models/index');
const logger = require('../utils/logger');

// Chạy mỗi phút — tìm CartItems có holdExpiry đã hết hạn, HOÀN LẠI stock thật đã
// trừ lúc /cart/hold (xem cart.controller.js), rồi xóa cờ holdExpiry.
const startStockReleaseJob = () => {
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      // Tìm các giỏ hàng có item hết hạn giữ hàng
      const cartsWithExpired = await Cart.find({ 'items.holdExpiry': { $lt: now } }).lean();
      if (!cartsWithExpired.length) return;

      let totalRestored = 0;
      let modifiedCarts = 0;

      for (const cart of cartsWithExpired) {
        // Atomic Update: Unset cờ holdExpiry TRƯỚC và lấy về document CŨ.
        // Chỉ tiến trình nào unset thành công mới được phép cộng trả kho.
        const oldCart = await Cart.findOneAndUpdate(
          { _id: cart._id, 'items.holdExpiry': { $lt: now } },
          { $unset: { 'items.$[expired].holdExpiry': '' } },
          { arrayFilters: [{ 'expired.holdExpiry': { $lt: now } }], new: false }
        );

        // Nếu null tức là tiến trình khác (hoặc user) đã dọn dẹp giỏ hàng này rồi
        if (!oldCart) continue;

        // Chỉ khôi phục những item có holdExpiry đã thực sự bị unset trong oldCart
        const restoredItems = oldCart.items.filter(item => item.holdExpiry && item.holdExpiry < now);
        
        if (restoredItems.length > 0) {
          modifiedCarts++;
          totalRestored += restoredItems.length;
          
          const restoreOps = restoredItems.map(item =>
            ProductVariant.findByIdAndUpdate(item.variantId, { $inc: { stock: item.quantity } })
          );
          // Cộng kho bằng Promise.allSettled để nếu 1 item lỗi thì các item khác vẫn được cộng
          await Promise.allSettled(restoreOps);
        }
      }

      if (modifiedCarts > 0) {
        logger.info(`[StockRelease] Hoàn kho + giải phóng hold cho ${modifiedCarts} giỏ hàng (${totalRestored} item)`);
      }
    } catch (err) {
      logger.error(`[StockRelease] Lỗi: ${err.message}`);
    }
  });

  logger.info('[StockRelease] Cron job khởi động — chạy mỗi phút');
};

module.exports = { startStockReleaseJob };
