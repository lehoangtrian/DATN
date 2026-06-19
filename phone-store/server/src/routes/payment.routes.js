const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/payment.controller');
const { protect } = require('../middlewares/auth.middleware');

// VNPay — return và IPN không cần auth (VNPay gọi trực tiếp)
router.get('/vnpay/return', ctrl.vnpayReturn);
router.get('/vnpay/ipn', ctrl.vnpayIPN);

// Các route cần đăng nhập
router.post('/vnpay/create', protect, ctrl.createVNPayUrl);
router.get('/status/:orderId', protect, ctrl.getPaymentStatus);

module.exports = router;
