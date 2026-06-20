const Joi = require('joi');

const shippingAddress = Joi.object({
  fullName: Joi.string().min(2).max(100).required().messages({
    'any.required': 'Họ tên người nhận là bắt buộc',
    'string.min': 'Họ tên tối thiểu 2 ký tự',
  }),
  phone: Joi.string().pattern(/^(0|\+84)[0-9]{9}$/).required().messages({
    'any.required': 'Số điện thoại là bắt buộc',
    'string.pattern.base': 'Số điện thoại không hợp lệ',
  }),
  address: Joi.string().min(5).max(200).required().messages({
    'any.required': 'Địa chỉ là bắt buộc',
    'string.min': 'Địa chỉ tối thiểu 5 ký tự',
  }),
  city: Joi.string().min(2).max(100).required().messages({
    'any.required': 'Tỉnh/thành phố là bắt buộc',
  }),
  district: Joi.string().min(2).max(100).required().messages({
    'any.required': 'Quận/huyện là bắt buộc',
  }),
});

const createOrder = Joi.object({
  shippingAddress: shippingAddress.required(),
  paymentMethod: Joi.string().valid('cod', 'bank_transfer', 'momo', 'zalopay', 'vnpay', 'wallet').default('cod'),
  shippingPartner: Joi.string().valid('GHN', 'GHTK', 'ViettelPost', 'store_pickup').default('GHN'),
  note: Joi.string().max(500).allow('').optional(),
  couponCode: Joi.string().max(50).optional(),
  pointsUsed: Joi.number().integer().min(0).optional(),
  selectedVariantIds: Joi.array().items(Joi.string().hex().length(24)).optional(),
});

module.exports = { createOrder };
