const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String },
  password: { type: String },
  avatar: { type: String },
  role: { type: String, enum: ['user', 'admin', 'staff'], default: 'user' },
  permissions: [{ type: String, enum: require('../config/permissions').PERMISSIONS }],
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  authProvider: { type: String, enum: ['local', 'google', 'facebook'], default: 'local' },
  googleId: { type: String, sparse: true },
  facebookId: { type: String, sparse: true },
  // Loyalty
  memberTier: { type: String, enum: ['bronze', 'silver', 'gold', 'platinum'], default: 'bronze' },
  totalSpent: { type: Number, default: 0 },
  loyaltyPoints: { type: Number, default: 0, min: 0 },
  birthday: { type: Date },
  birthMonth: { type: Number, min: 1, max: 12 },
  birthDay: { type: Number, min: 1, max: 31 },
  // Address
  addresses: [{
    label: String,
    fullName: String,
    phone: String,
    address: String,
    city: String,
    district: String,
    isDefault: { type: Boolean, default: false },
  }],
  // Ví điện tử
  walletBalance: { type: Number, default: 0, min: 0 },
  lastLoginAt: { type: Date },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (this.isModified('birthday') && this.birthday) {
    const d = new Date(this.birthday);
    if (!isNaN(d.getTime())) {
      this.birthMonth = d.getMonth() + 1;
      this.birthDay = d.getDate();
    }
  }
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = function (password) {
  return bcrypt.compare(password, this.password);
};

userSchema.index({ birthMonth: 1, birthDay: 1, isActive: 1 }, { sparse: true });

module.exports = mongoose.model('User', userSchema);
