const mongoose = require('mongoose');
const serviceBadgeSchema = new mongoose.Schema({
  iconName:    { type: String, default: 'truck' },
  iconColor:   { type: String, default: 'text-blue-500' },
  bgColor:     { type: String, default: 'bg-blue-50' },
  title:       { type: String, required: true },
  description: { type: String, default: '' },
  order:       { type: Number, default: 0 },
  isActive:    { type: Boolean, default: true },
}, { timestamps: true });
module.exports = mongoose.model('ServiceBadge', serviceBadgeSchema);
