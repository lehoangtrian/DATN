const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name_vi: { type: String, required: true },
  name_en: { type: String },
  slug: { type: String, required: true, unique: true, lowercase: true },
  description: { type: String },
  image: { type: String },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

categorySchema.index({ slug: 1, isActive: 1 });
categorySchema.index({ isActive: 1, sortOrder: 1 });
categorySchema.index({ parentId: 1, isActive: 1 });

module.exports = mongoose.model('Category', categorySchema);
