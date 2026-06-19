const Joi = require('joi');

const addItem = Joi.object({
  variantId: Joi.string().hex().length(24).required().messages({ 'any.required': 'variantId là bắt buộc' }),
  quantity: Joi.number().integer().min(1).max(10).default(1),
});

const updateItem = Joi.object({
  quantity: Joi.number().integer().min(0).max(10).required(),
});

module.exports = { addItem, updateItem };
