const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1, default: 1 },
  price: { type: Number, required: true },
  holdExpiry: { type: Date }, // giữ hàng tạm thời khi checkout
}, { timestamps: true });

const cartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: [cartItemSchema],
  couponCode: { type: String },
  discountAmount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = {
  Cart: mongoose.model('Cart', cartSchema),
};
