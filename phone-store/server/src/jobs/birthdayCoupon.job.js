const cron = require('node-cron');
const { User, Coupon } = require('../models/index');
const { createNotification } = require('../controllers/notification.controller');
const { sendEmail } = require('../utils/otp.utils');
const { birthdayEmail } = require('../utils/emailTemplates');
const logger = require('../utils/logger');

// Chạy một lần khi khởi động để backfill birthMonth/birthDay cho user cũ
const runBirthdayBackfill = async () => {
  try {
    const staleUsers = await User.find(
      { birthday: { $exists: true, $ne: null }, birthMonth: { $exists: false } },
      { _id: 1, birthday: 1 }
    ).lean();
    if (staleUsers.length > 0) {
      await Promise.all(staleUsers.map((u) => {
        const d = new Date(u.birthday);
        return User.updateOne({ _id: u._id }, { birthMonth: d.getMonth() + 1, birthDay: d.getDate() });
      }));
      logger.info(`[BirthdayCoupon] Backfilled birthMonth/birthDay cho ${staleUsers.length} user`);
    }
  } catch (err) {
    logger.error(`[BirthdayCoupon] Backfill lỗi: ${err.message}`);
  }
};

// Chạy lúc 8:00 AM mỗi ngày — tặng coupon sinh nhật cho thành viên
const startBirthdayCouponJob = async () => {
  // Backfill một lần khi server khởi động — pre-save hook xử lý user mới từ đây về sau
  await runBirthdayBackfill();

  cron.schedule('0 8 * * *', async () => {
    try {
      const today = new Date();
      const month = today.getMonth() + 1;
      const day = today.getDate();
      const year = today.getFullYear();

      // Query dùng index thay vì $expr
      const birthdayUsers = await User.find({
        birthMonth: month,
        birthDay: day,
        isActive: true,
      }).select('_id name email').lean();

      if (!birthdayUsers.length) return;
      logger.info(`[BirthdayCoupon] ${birthdayUsers.length} user sinh nhật hôm nay`);

      // Xử lý từng user song song
      await Promise.allSettled(birthdayUsers.map(async (user) => {
        try {
          const couponCode = `BDAY${year}${user._id.toString().slice(-12).toUpperCase()}`;

          const startDate = new Date();
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + 7);

          // Upsert atomic — tránh race condition khi server restart
          const result = await Coupon.updateOne(
            { code: couponCode },
            {
              $setOnInsert: {
                code: couponCode,
                description: `Ưu đãi sinh nhật dành riêng cho ${user.name}`,
                type: 'percent',
                value: 10,
                minOrderValue: 1_000_000,
                maxDiscountAmount: 200_000,
                usageLimit: 1,
                userUsageLimit: 1,
                allowedUserId: user._id,
                startDate,
                endDate,
                isActive: true,
              },
            },
            { upsert: true }
          );

          if (!result.upsertedCount) {
            logger.info(`[BirthdayCoupon] ${user.email} — coupon năm nay đã tồn tại, bỏ qua`);
            return;
          }

          await createNotification({
            userId: user._id,
            title: '🎂 Chúc mừng sinh nhật!',
            content: `PhoneStore tặng bạn mã ${couponCode} — giảm 10%, tối đa 200.000đ cho đơn từ 1.000.000đ. Hiệu lực 7 ngày!`,
            type: 'promotion',
            link: '/products',
            metadata: { couponCode, expiryDate: endDate },
          });

          if (user.email) {
            const { subject, html } = birthdayEmail(user.name, couponCode, endDate);
            await sendEmail({ to: user.email, subject, html });
          }

          logger.info(`[BirthdayCoupon] Đã gửi coupon ${couponCode} → ${user.email}`);
        } catch (userErr) {
          logger.error(`[BirthdayCoupon] Lỗi với user ${user._id}: ${userErr.message}`);
        }
      }));

      logger.info(`[BirthdayCoupon] Hoàn thành — xử lý ${birthdayUsers.length} user`);
    } catch (err) {
      logger.error(`[BirthdayCoupon] Lỗi: ${err.message}`);
    }
  });

  logger.info('[BirthdayCoupon] Cron job khởi động — chạy lúc 8:00 AM mỗi ngày');
};

module.exports = { startBirthdayCouponJob };
