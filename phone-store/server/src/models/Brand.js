const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  logo: { type: String },
  description: { type: String },
  // Phân biệt hãng điện thoại (Apple, Samsung...) vs hãng phụ kiện (Anker, Baseus...)
  // — dùng để lọc sidebar thương hiệu theo đúng tab Điện thoại/Phụ kiện ở PhoneListPage.
  type: { type: String, enum: ['phone', 'accessory'], default: 'phone' },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

brandSchema.index({ slug: 1, isActive: 1 });
brandSchema.index({ isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('Brand', brandSchema);
