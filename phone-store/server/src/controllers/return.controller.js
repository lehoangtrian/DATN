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
    const { orderId, reason, description, refundBankInfo, items } = req.body;

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

    // Nếu client chỉ định items cụ thể (trả 1 phần đơn) → tính refund theo đúng sản phẩm/số lượng đó.
    // Nếu không chỉ định (UI hiện tại trả cả đơn) → giữ hành vi cũ: hoàn toàn bộ totalPrice.
    let returnItems = [];
    let refundAmount = order.totalPrice;

    if (Array.isArray(items) && items.length > 0) {
      refundAmount = 0;
      for (const reqItem of items) {
        const orderItem = order.items.find((oi) => oi._id.toString() === reqItem.orderItemId);
        if (!orderItem) {
          return error(res, 'Sản phẩm trả hàng không khớp với đơn hàng', 400);
        }
        const qty = Number(reqItem.quantity) || 0;
        if (qty <= 0 || qty > orderItem.quantity) {
          return error(res, `Số lượng trả của "${orderItem.name}" không hợp lệ`, 400);
        }
        refundAmount += orderItem.price * qty;
        returnItems.push({
          orderItemId: orderItem._id,
          productId: orderItem.productId,
          quantity: qty,
          reason: reqItem.reason || reason,
        });
      }
    }

    const returnReq = await ReturnRequest.create({
      orderId,
      userId: req.user._id,
      reason,
      description,
      items: returnItems,
      refundAmount,
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
