const crypto = require('crypto');
const { User, Coupon } = require('../models/index');
const { success, error } = require('../utils/response.utils');

// 1 điểm = 1.000đ — khớp tỉ lệ hiển thị ở ProfilePage và giảm giá trực tiếp lúc checkout
// (xem order.controller.js createOrder, pointsUsed/pointsDiscount).
const POINT_TO_VND = 1000;
const MIN_REDEEM_POINTS = 50; // tối thiểu 50 điểm (50.000đ) để tránh tạo coupon vụn vặt
const COUPON_VALID_DAYS = 30;

// POST /api/loyalty/redeem — đổi điểm tích lũy sang mã giảm giá cá nhân (fixed amount)
const redeemPointsToCoupon = async (req, res, next) => {
  try {
    const points = Math.floor(Number(req.body.points));
    if (!points || points < MIN_REDEEM_POINTS) {
      return error(res, `Tối thiểu ${MIN_REDEEM_POINTS} điểm để đổi mã giảm giá`, 400);
    }

    // Atomic trừ điểm — chống race condition khi đổi 2 lần gần nhau
    const updatedUser = await User.findOneAndUpdate(
      { _id: req.user._id, loyaltyPoints: { $gte: points } },
      { $inc: { loyaltyPoints: -points } },
      { new: true }
    );
    if (!updatedUser) return error(res, 'Số điểm tích lũy không đủ', 400);

    const value = points * POINT_TO_VND;
    const code = `PT${req.user._id.toString().slice(-6).toUpperCase()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const startDate = new Date();
    const endDate = new Date(Date.now() + COUPON_VALID_DAYS * 24 * 60 * 60 * 1000);

    const coupon = await Coupon.create({
      code,
      description: `Đổi từ ${points.toLocaleString('vi-VN')} điểm tích lũy`,
      type: 'fixed',
      value,
      usageLimit: 1,
      userUsageLimit: 1,
      allowedUserId: req.user._id,
      startDate,
      endDate,
      isActive: true,
    });

    return success(res, {
      data: { code: coupon.code, value, endDate, remainingPoints: updatedUser.loyaltyPoints },
    }, `Đổi thành công — mã ${coupon.code} giảm ${value.toLocaleString('vi-VN')}đ, hiệu lực ${COUPON_VALID_DAYS} ngày`, 201);
  } catch (err) {
    next(err);
  }
};

module.exports = { redeemPointsToCoupon };
