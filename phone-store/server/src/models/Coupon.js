const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true },
  description: { type: String },
  type: { type: String, enum: ['percent', 'fixed'], required: true },
  value: { type: Number, required: true },
  minOrderValue: { type: Number, default: 0 },
  maxDiscountAmount: { type: Number },
  usageLimit: { type: Number },
  usedCount: { type: Number, default: 0 },
  userUsageLimit: { type: Number, default: 1 },
  usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  allowedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  applicableBrands: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Brand' }],
  applicableCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
  userType: { type: String, enum: ['all', 'new', 'bronze', 'silver', 'gold', 'platinum'], default: 'all' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

couponSchema.pre('save', function (next) {
  if (this.startDate && this.endDate && this.startDate >= this.endDate) {
    return next(new Error('Ngày bắt đầu phải trước ngày kết thúc'));
  }
  if (this.type === 'percent' && this.value > 100) {
    return next(new Error('Giá trị coupon phần trăm không được vượt quá 100%'));
  }
  next();
});

couponSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('Coupon', couponSchema);
