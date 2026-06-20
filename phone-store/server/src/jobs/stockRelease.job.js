const cron = require('node-cron');
const { Cart, ProductVariant } = require('../models/index');
const logger = require('../utils/logger');

// Chạy mỗi phút — tìm CartItems có holdExpiry đã hết hạn, HOÀN LẠI stock thật đã
// trừ lúc /cart/hold (xem cart.controller.js), rồi xóa cờ holdExpiry.
const startStockReleaseJob = () => {
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const cartsWithExpired = await Cart.find({ 'items.holdExpiry': { $lt: now } }).lean();
      if (!cartsWithExpired.length) return;

      const restoreOps = [];
      for (const cart of cartsWithExpired) {
        for (const item of cart.items) {
          if (item.holdExpiry && item.holdExpiry < now) {
            restoreOps.push(ProductVariant.findByIdAndUpdate(item.variantId, { $inc: { stock: item.quantity } }));
          }
        }
      }
      await Promise.allSettled(restoreOps);

      const result = await Cart.updateMany(
        { 'items.holdExpiry': { $lt: now } },
        { $unset: { 'items.$[expired].holdExpiry': '' } },
        { arrayFilters: [{ 'expired.holdExpiry': { $lt: now } }] }
      );
      if (result.modifiedCount > 0) {
        logger.info(`[StockRelease] Hoàn kho + giải phóng hold cho ${result.modifiedCount} giỏ hàng (${restoreOps.length} item)`);
      }
    } catch (err) {
      logger.error(`[StockRelease] Lỗi: ${err.message}`);
    }
  });

  logger.info('[StockRelease] Cron job khởi động — chạy mỗi phút');
};

module.exports = { startStockReleaseJob };
