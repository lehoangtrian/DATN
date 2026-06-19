const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  description: { type: String },
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  images: [{ type: String }],
  status: { type: String, enum: ['coming_soon', 'selling', 'discontinued'], default: 'selling' },
  specs: {
    display: String,
    chip: String,
    ram: String,
    battery: String,
    camera: String,
    os: String,
    sim: String,
    connectivity: String,
  },
  badge: { type: String, enum: ['New', 'Hot', 'Sale', 'Best Seller'] },
  relatedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  rating: { type: Number, default: 0, min: 0, max: 5 },
  reviewCount: { type: Number, default: 0 },
  sold: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true },
  tags: [String],
  warrantyMonths: { type: Number, default: 12 },
  seo: {
    metaTitle: { type: String, default: '' },
    metaDescription: { type: String, default: '' },
    keywords: [String],
  },
}, { timestamps: true });

productSchema.index({ brandId: 1, categoryId: 1, status: 1 });

module.exports = mongoose.model('Product', productSchema);
