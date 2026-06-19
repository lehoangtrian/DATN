const cron = require('node-cron');
const { Cart } = require('../models/index');
const logger = require('../utils/logger');

// Chạy mỗi phút — tìm CartItems có holdExpiry đã hết hạn và xóa hold
const startStockReleaseJob = () => {
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const result = await Cart.updateMany(
        { 'items.holdExpiry': { $lt: now } },
        { $unset: { 'items.$[expired].holdExpiry': '' } },
        { arrayFilters: [{ 'expired.holdExpiry': { $lt: now } }] }
      );
      if (result.modifiedCount > 0) {
        logger.info(`[StockRelease] Giải phóng hold cho ${result.modifiedCount} giỏ hàng`);
      }
    } catch (err) {
      logger.error(`[StockRelease] Lỗi: ${err.message}`);
    }
  });

  logger.info('[StockRelease] Cron job khởi động — chạy mỗi phút');
};

module.exports = { startStockReleaseJob };
