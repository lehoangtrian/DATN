const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  logo: { type: String },
  description: { type: String },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

brandSchema.index({ slug: 1, isActive: 1 });
brandSchema.index({ isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('Brand', brandSchema);
