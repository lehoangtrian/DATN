const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
  type:        { type: String, enum: ['slide', 'promo'], default: 'slide' },
  tag:         { type: String, default: '' },
  title:       { type: String, required: true },
  description: { type: String, default: '' },
  cta:         { type: String, default: 'Xem ngay' },
  link:        { type: String, default: '/products' },
  bg:          { type: String, default: 'linear-gradient(135deg, #E53E3E 0%, #C53030 100%)' },
  imageUrl:    { type: String, default: '' },
  emoji:       { type: String, default: '📱' },
  accentBg:    { type: String, default: 'bg-yellow-400' },
  accentText:  { type: String, default: 'text-red-700' },
  isActive:    { type: Boolean, default: true },
  order:       { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Banner', bannerSchema);
