const { Order, Payment } = require('../models/index');
const { createPaymentUrl, verifySignature } = require('../utils/vnpay.utils');
const { success, error } = require('../utils/response.utils');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// POST /api/payments/vnpay/create
// Tạo URL thanh toán VNPay, trả về cho client để redirect
const createVNPayUrl = async (req, res, next) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return error(res, 'Thiếu orderId', 400);

    const order = await Order.findOne({ _id: orderId, userId: req.user._id });
    if (!order) return error(res, 'Không tìm thấy đơn hàng', 404);
    if (order.paymentMethod !== 'vnpay') return error(res, 'Đơn hàng không dùng VNPay', 400);
    if (order.paymentStatus === 'paid') return error(res, 'Đơn hàng đã được thanh toán', 400);

    // Tạo hoặc cập nhật Payment record
    await Payment.findOneAndUpdate(
      { orderId: order._id },
      { orderId: order._id, userId: req.user._id, method: 'vnpay', amount: order.totalPrice, status: 'pending', gateway: 'vnpay' },
      { upsert: true, new: true }
    );

    // req.ip respects trust proxy setting — dùng thay vì tự parse x-forwarded-for (có thể bị spoof)
    const ipAddr = req.ip || req.socket.remoteAddress || '127.0.0.1';

    const paymentUrl = createPaymentUrl({
      txnRef: order.orderCode,
      amount: order.totalPrice,
      orderInfo: `Thanh toan don hang ${order.orderCode}`,
      ipAddr,
    });

    success(res, { data: { paymentUrl } });
  } catch (err) { next(err); }
};

// GET /api/payments/vnpay/return
// VNPay redirect user trình duyệt về đây sau khi thanh toán
const vnpayReturn = async (req, res, next) => {
  try {
    const isValid = verifySignature(req.query);
    const responseCode = req.query.vnp_ResponseCode;
    const txnRef = req.query.vnp_TxnRef; // orderCode

    if (!isValid) {
      return res.redirect(`${CLIENT_URL}/payment/result?success=false&reason=invalid_signature`);
    }

    const order = await Order.findOne({ orderCode: txnRef });
    if (!order) {
      return res.redirect(`${CLIENT_URL}/payment/result?success=false&reason=order_not_found`);
    }

    if (responseCode === '00') {
      // Atomic update dùng aggregation pipeline — status được đọc tại thời điểm update
      // tránh race condition khi admin đã chuyển order sang trạng thái khác
      const updated = await Order.findOneAndUpdate(
        { _id: order._id, paymentStatus: { $ne: 'paid' } },
        [{ $set: {
          paymentStatus: 'paid',
          status: { $cond: [{ $eq: ['$status', 'pending'] }, 'confirmed', '$status'] },
        }}],
        { new: true }
      );

      if (updated) {
        await Payment.findOneAndUpdate(
          { orderId: order._id },
          { status: 'success', transactionId: req.query.vnp_TransactionNo, gatewayResponse: req.query, paidAt: new Date() }
        );
      }

      return res.redirect(`${CLIENT_URL}/payment/result?success=true&orderId=${order._id}`);
    } else {
      // Thanh toán thất bại hoặc bị hủy
      await Payment.findOneAndUpdate(
        { orderId: order._id },
        { status: 'failed', gatewayResponse: req.query }
      );

      return res.redirect(`${CLIENT_URL}/payment/result?success=false&orderId=${order._id}&code=${responseCode}`);
    }
  } catch (err) { next(err); }
};

// GET /api/payments/vnpay/ipn
// VNPay gọi server-to-server để xác nhận (không qua trình duyệt)
const vnpayIPN = async (req, res, next) => {
  try {
    const isValid = verifySignature(req.query);
    if (!isValid) return res.json({ RspCode: '97', Message: 'Invalid signature' });

    const order = await Order.findOne({ orderCode: req.query.vnp_TxnRef });
    if (!order) return res.json({ RspCode: '01', Message: 'Order not found' });

    // So sánh sau khi làm tròn để tránh lỗi floating-point (vnp_Amount tính theo đồng × 100)
    const vnpAmount = Math.round(Number(req.query.vnp_Amount) / 100);
    if (vnpAmount !== Math.round(order.totalPrice)) return res.json({ RspCode: '04', Message: 'Invalid amount' });

    if (order.paymentStatus === 'paid') return res.json({ RspCode: '02', Message: 'Order already confirmed' });

    if (req.query.vnp_ResponseCode === '00') {
      // Atomic update dùng aggregation pipeline — tránh race condition stale status
      const updated = await Order.findOneAndUpdate(
        { _id: order._id, paymentStatus: { $ne: 'paid' } },
        [{ $set: {
          paymentStatus: 'paid',
          status: { $cond: [{ $eq: ['$status', 'pending'] }, 'confirmed', '$status'] },
        }}],
        { new: true }
      );

      if (updated) {
        await Payment.findOneAndUpdate(
          { orderId: order._id },
          { status: 'success', transactionId: req.query.vnp_TransactionNo, gatewayResponse: req.query, paidAt: new Date() }
        );
      }
    }

    return res.json({ RspCode: '00', Message: 'Confirm Success' });
  } catch (err) {
    return res.json({ RspCode: '99', Message: 'Server error' });
  }
};

// GET /api/payments/status/:orderId
// Client hỏi trạng thái thanh toán
const getPaymentStatus = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, userId: req.user._id })
      .select('paymentStatus paymentMethod status orderCode totalPrice');
    if (!order) return error(res, 'Không tìm thấy đơn hàng', 404);
    success(res, { data: order });
  } catch (err) { next(err); }
};

module.exports = { createVNPayUrl, vnpayReturn, vnpayIPN, getPaymentStatus };
