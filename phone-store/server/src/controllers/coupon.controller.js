const { Coupon, Cart, Order } = require('../models/index');
const { success, error } = require('../utils/response.utils');

// POST /api/coupons/validate
const validateCoupon = async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) return error(res, 'Vui lòng nhập mã giảm giá', 400);

    // Validate cartTotal — phải là số hợp lệ không âm
    const cartTotal = Number(req.body.cartTotal);
    if (isNaN(cartTotal) || cartTotal < 0) {
      return error(res, 'Giá trị đơn hàng không hợp lệ', 400);
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
    if (!coupon) return error(res, 'Mã giảm giá không tồn tại', 404);

    const now = new Date();
    if (now < coupon.startDate) return error(res, 'Mã giảm giá chưa có hiệu lực', 400);
    if (now > coupon.endDate) return error(res, 'Mã giảm giá đã hết hạn', 400);
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return error(res, 'Mã giảm giá đã hết lượt sử dụng', 400);
    }

    // Coupon dành riêng cho user — chặn cả khi chưa đăng nhập
    if (coupon.allowedUserId) {
      if (!req.user || coupon.allowedUserId.toString() !== req.user._id.toString()) {
        return error(res, 'Mã giảm giá này không dành cho bạn', 403);
      }
    }

    // Kiểm tra giới hạn sử dụng theo user (userUsageLimit)
    if (req.user && coupon.userUsageLimit > 0) {
      const userId = req.user._id.toString();
      const userUsedCount = (coupon.usedBy || []).filter((id) => id.toString() === userId).length;
      if (userUsedCount >= coupon.userUsageLimit) {
        return error(res, 'Bạn đã đạt giới hạn sử dụng mã này', 400);
      }
    }

    if (cartTotal < coupon.minOrderValue) {
      return error(res, `Đơn hàng tối thiểu ${coupon.minOrderValue.toLocaleString('vi-VN')}đ để dùng mã này`, 400);
    }

    // Kiểm tra loại user
    if (coupon.userType === 'new') {
      // Coupon dành cho user mới: chưa có đơn hàng completed nào
      if (!req.user) return error(res, 'Vui lòng đăng nhập để sử dụng mã này', 401);
      const prevOrders = await Order.countDocuments({
        userId: req.user._id,
        status: { $in: ['confirmed', 'preparing', 'shipping', 'delivered'] },
      });
      if (prevOrders > 0) return error(res, 'Mã này chỉ dành cho khách hàng mua lần đầu', 400);
    } else if (coupon.userType !== 'all') {
      // Kiểm tra hạng thành viên — platinum ≥ gold ≥ silver ≥ bronze
      if (!req.user) return error(res, 'Vui lòng đăng nhập để sử dụng mã này', 401);
      const TIER_RANK = { bronze: 0, silver: 1, gold: 2, platinum: 3 };
      const userTier = req.user?.memberTier || 'bronze';
      if ((TIER_RANK[userTier] ?? 0) < (TIER_RANK[coupon.userType] ?? 0)) {
        return error(res, `Mã này yêu cầu hạng thành viên ${coupon.userType} trở lên`, 400);
      }
    }

    // Tính discount
    let discountAmount = coupon.type === 'percent'
      ? Math.round((cartTotal * coupon.value) / 100)
      : coupon.value;

    if (coupon.maxDiscountAmount) {
      discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
    }

    return success(res, {
      data: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        discountAmount,
        description: coupon.description,
      },
    }, `Áp dụng thành công — giảm ${discountAmount.toLocaleString('vi-VN')}đ`);
  } catch (err) { next(err); }
};

// GET /api/coupons — danh sách coupon public (đang active)
const getActiveCoupons = async (req, res, next) => {
  try {
    const now = new Date();
    const coupons = await Coupon.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      $and: [
        { $or: [{ usageLimit: null }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }] },
        // Hiển thị coupon userType 'all' + các tier bằng hoặc thấp hơn tier user hiện tại
        { $or: [
          { userType: 'all' },
          ...(['bronze', 'silver', 'gold', 'platinum'].slice(
            0,
            ['bronze', 'silver', 'gold', 'platinum'].indexOf(req.user?.memberTier || 'bronze') + 1
          )).map((t) => ({ userType: t })),
        ] },
        // Coupon cá nhân (allowedUserId, vd đổi từ điểm/sinh nhật) chỉ hiện cho đúng
        // chủ sở hữu — không lộ code/mô tả của người khác trong danh sách public.
        { $or: [
          { allowedUserId: null },
          { allowedUserId: req.user?._id || null },
        ] },
      ],
    })
      .select('code type value description minOrderValue maxDiscountAmount endDate userType')
      .sort({ value: -1 })
      .limit(20)
      .lean();
    return success(res, { data: coupons });
  } catch (err) { next(err); }
};

module.exports = { validateCoupon, getActiveCoupons };
