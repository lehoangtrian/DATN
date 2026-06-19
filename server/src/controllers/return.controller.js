const { Order, ReturnRequest } = require('../models/index');
const { success, error } = require('../utils/response.utils');

const RETURN_REASONS = [
  'Sản phẩm bị lỗi / hư hỏng',
  'Sản phẩm không đúng mô tả',
  'Giao nhầm sản phẩm',
  'Sản phẩm không vừa ý',
  'Lý do khác',
];

// POST /api/returns
const createReturn = async (req, res, next) => {
  try {
    const { orderId, reason, description, refundBankInfo } = req.body;

    if (!RETURN_REASONS.includes(reason)) {
      return error(res, 'Lý do trả hàng không hợp lệ', 400);
    }

    const order = await Order.findOne({ _id: orderId, userId: req.user._id });
    if (!order) return error(res, 'Không tìm thấy đơn hàng', 404);
    if (order.status !== 'delivered') return error(res, 'Chỉ có thể yêu cầu trả hàng đã giao thành công', 400);

    const existing = await ReturnRequest.findOne({
      orderId: order._id,
      status: { $nin: ['rejected', 'completed'] },
    });
    if (existing) return error(res, 'Đơn hàng này đã có yêu cầu trả hàng', 400);

    // Kiểm tra thời gian (7 ngày kể từ khi nhận)
    // Không dùng updatedAt làm fallback vì updatedAt có thể cập nhật vì lý do khác → tính sai cửa sổ 7 ngày
    const deliveredAt = order.deliveredAt;
    if (!deliveredAt) return error(res, 'Không xác định được ngày nhận hàng', 400);
    const daysSince = (Date.now() - new Date(deliveredAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > 7) return error(res, 'Đã quá 7 ngày kể từ khi nhận hàng, không thể yêu cầu trả', 400);

    const returnReq = await ReturnRequest.create({
      orderId,
      userId: req.user._id,
      reason,
      description,
      refundAmount: order.totalPrice,
      refundBankInfo: refundBankInfo || undefined,
    });

    await Order.findByIdAndUpdate(orderId, { status: 'return_requested' });

    return success(res, { data: returnReq }, 'Yêu cầu trả hàng đã được gửi thành công', 201);
  } catch (err) {
    if (err.code === 11000) return error(res, 'Đơn hàng này đã có yêu cầu trả hàng', 400);
    next(err);
  }
};

// GET /api/returns
const getMyReturns = async (req, res, next) => {
  try {
    const returns = await ReturnRequest.find({ userId: req.user._id })
      .populate('orderId', 'orderCode totalPrice paymentMethod paymentStatus createdAt')
      .sort({ createdAt: -1 })
      .lean();
    return success(res, { data: returns });
  } catch (err) { next(err); }
};

// GET /api/returns/:id
const getReturnById = async (req, res, next) => {
  try {
    const returnReq = await ReturnRequest.findOne({ _id: req.params.id, userId: req.user._id })
      .populate('orderId', 'orderCode totalPrice paymentMethod shippingAddress items')
      .lean();
    if (!returnReq) return error(res, 'Không tìm thấy yêu cầu trả hàng', 404);
    return success(res, { data: returnReq });
  } catch (err) { next(err); }
};

// GET /api/returns/order/:orderId — kiểm tra return request của một đơn
const getReturnByOrder = async (req, res, next) => {
  try {
    const returnReq = await ReturnRequest.findOne({ orderId: req.params.orderId, userId: req.user._id }).lean();
    return success(res, { data: returnReq || null });
  } catch (err) { next(err); }
};

module.exports = { createReturn, getMyReturns, getReturnById, getReturnByOrder };
