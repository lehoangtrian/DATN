const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name_vi: { type: String, required: true },
  name_en: { type: String },
  slug: { type: String, required: true, unique: true, lowercase: true },
  description: { type: String },
  image: { type: String },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  // Phân biệt danh mục điện thoại vs phụ kiện — dùng để lọc BrandPage (chỉ điện thoại)
  // tách khỏi AccessoriesPage (chỉ phụ kiện) dù cùng brandId (vd Apple bán cả 2 loại).
  type: { type: String, enum: ['phone', 'accessory'], default: 'phone' },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

categorySchema.index({ slug: 1, isActive: 1 });
categorySchema.index({ isActive: 1, sortOrder: 1 });
categorySchema.index({ parentId: 1, isActive: 1 });

module.exports = mongoose.model('Category', categorySchema);
