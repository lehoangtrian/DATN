const Joi = require('joi');

const listProducts = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  brand: Joi.string().optional(),
  category: Joi.string().optional(),
  categories: Joi.string().optional(),
  productType: Joi.string().valid('phone', 'accessory').optional(),
  ram: Joi.string().optional(),
  minBattery: Joi.number().min(0).optional(),
  maxBattery: Joi.number().optional(),
  minPrice: Joi.number().min(0).optional(),
  maxPrice: Joi.number().optional(),
  status: Joi.string().valid('coming_soon', 'selling', 'discontinued').optional(),
  sort: Joi.string().valid('newest', 'price_asc', 'price_desc', 'popular', 'rating').default('newest'),
  q: Joi.string().optional(),
});

const compareProducts = Joi.object({
  ids: Joi.string().required().messages({ 'any.required': 'Danh sách id là bắt buộc' }),
});

module.exports = { listProducts, compareProducts };
