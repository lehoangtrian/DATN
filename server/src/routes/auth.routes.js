const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/auth.controller');
const { validate } = require('../middlewares/validate.middleware');
const { protect } = require('../middlewares/auth.middleware');
const { loginLimiter, otpLimiter } = require('../middlewares/rateLimiter');
const v = require('../validations/auth.validation');

router.post('/register', validate(v.register), ctrl.register);
router.post('/verify-otp', otpLimiter, validate(v.verifyOTP), ctrl.verifyOTP);
router.post('/resend-otp', otpLimiter, ctrl.resendOTP);
router.post('/login', loginLimiter, validate(v.login), ctrl.login);
router.post('/refresh-token', validate(v.refreshToken), ctrl.refreshToken);
router.post('/forgot-password', otpLimiter, validate(v.forgotPassword), ctrl.forgotPassword);
router.post('/reset-password', validate(v.resetPassword), ctrl.resetPassword);
router.get('/me', protect, ctrl.getMe);

// OAuth social login
router.post('/google', ctrl.googleAuth);
router.post('/facebook', ctrl.facebookAuth);

module.exports = router;
