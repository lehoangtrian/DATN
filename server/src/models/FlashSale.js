const mongoose = require('mongoose');

const flashSaleSchema = new mongoose.Schema({
  type: { type: String, enum: ['variant', 'category'], default: 'variant' },
  name: { type: String, required: true },
  // variant-type fields
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant', default: null },
  originalPrice: { type: Number, default: null },
  salePrice: { type: Number, default: null },
  // category-type field
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  // common fields
  discountType: { type: String, enum: ['percent', 'amount'], default: 'percent' },
  discountValue: { type: Number },
  quantity: { type: Number, min: 1, default: null }, // null = unlimited (category sales)
  sold: { type: Number, default: 0, min: 0 },
  limitPerUser: { type: Number, default: 1 },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

flashSaleSchema.pre('save', function (next) {
  if (this.startTime >= this.endTime)
    return next(new Error('Thời gian kết thúc phải sau thời gian bắt đầu'));

  if (this.type === 'variant') {
    if (!this.variantId || !this.productId || !this.originalPrice || !this.salePrice)
      return next(new Error('Thiếu thông tin bắt buộc cho variant flash sale'));
    if (this.salePrice >= this.originalPrice)
      return next(new Error('Giá flash sale phải thấp hơn giá gốc'));
  } else {
    if (!this.categoryId || !this.discountType || !this.discountValue)
      return next(new Error('Thiếu thông tin bắt buộc cho category flash sale'));
  }

  if (this.discountType === 'percent' && this.discountValue != null) {
    if (this.discountValue <= 0 || this.discountValue > 100)
      return next(new Error('discountValue kiểu percent phải trong khoảng 1-100'));
  }
  next();
});

flashSaleSchema.index({ startTime: 1, endTime: 1, isActive: 1 });
flashSaleSchema.index({ variantId: 1, isActive: 1, endTime: 1 });
flashSaleSchema.index({ categoryId: 1, isActive: 1, endTime: 1, type: 1 });

module.exports = mongoose.model('FlashSale', flashSaleSchema);
