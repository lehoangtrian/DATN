const rateLimit = require('express-rate-limit');

const createLimiter = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    message: { success: false, message },
    standardHeaders: true,
    legacyHeaders: false,
  });

const loginLimiter = createLimiter(
  15 * 60 * 1000, // 15 phút
  10,
  'Quá nhiều lần đăng nhập, thử lại sau 15 phút'
);

const otpLimiter = createLimiter(
  60 * 60 * 1000, // 1 giờ
  5,
  'Quá nhiều yêu cầu OTP, thử lại sau 1 giờ'
);

const apiLimiter = createLimiter(
  60 * 1000, // 1 phút
  100,
  'Quá nhiều request, thử lại sau 1 phút'
);

module.exports = { loginLimiter, otpLimiter, apiLimiter };
