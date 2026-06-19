const mongoose = require('mongoose');

const stockLogSchema = new mongoose.Schema({
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  type: { type: String, enum: ['import', 'sell', 'return', 'adjust', 'flash_sale'], required: true },
  quantity: { type: Number, required: true },
  stockBefore: { type: Number },
  stockAfter: { type: Number },
  note: { type: String },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

stockLogSchema.index({ variantId: 1, createdAt: -1 });

module.exports = mongoose.model('StockLog', stockLogSchema);
