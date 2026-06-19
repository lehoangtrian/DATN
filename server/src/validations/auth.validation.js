const Joi = require('joi');

const register = Joi.object({
  name: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Tên tối thiểu 2 ký tự',
    'any.required': 'Tên là bắt buộc',
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Email không hợp lệ',
    'any.required': 'Email là bắt buộc',
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Mật khẩu tối thiểu 6 ký tự',
    'any.required': 'Mật khẩu là bắt buộc',
  }),
  phone: Joi.string().pattern(/^(0|\+84)[0-9]{9}$/).optional().messages({
    'string.pattern.base': 'Số điện thoại không hợp lệ',
  }),
});

const login = Joi.object({
  email: Joi.string().email().required().messages({ 'any.required': 'Email là bắt buộc' }),
  password: Joi.string().required().messages({ 'any.required': 'Mật khẩu là bắt buộc' }),
});

const verifyOTP = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().length(6).required().messages({ 'string.length': 'OTP phải đúng 6 số' }),
  type: Joi.string().valid('verify_email', 'reset_password', 'login').required(),
});

const forgotPassword = Joi.object({
  email: Joi.string().email().required(),
});

const resetPassword = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().length(6).required(),
  newPassword: Joi.string().min(6).required().messages({ 'string.min': 'Mật khẩu mới tối thiểu 6 ký tự' }),
});

const refreshToken = Joi.object({
  refreshToken: Joi.string().required(),
});

module.exports = { register, login, verifyOTP, forgotPassword, resetPassword, refreshToken };
