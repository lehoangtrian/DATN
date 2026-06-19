const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  contact: { type: String, required: true }, // email or phone
  code: { type: String, required: true },
  type: { type: String, enum: ['verify_email', 'reset_password', 'verify_phone', 'login'], required: true },
  method: { type: String, enum: ['email', 'sms'], default: 'email' },
  isUsed: { type: Boolean, default: false },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ contact: 1, type: 1, isUsed: 1 });

module.exports = mongoose.model('OTP', otpSchema);
