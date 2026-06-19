const mongoose = require('mongoose');

const withdrawalRequestSchema = new mongoose.Schema({
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount:         { type: Number, required: true, min: 10000 },
  bankName:       { type: String, required: true },
  accountNumber:  { type: String, required: true },
  accountHolder:  { type: String, required: true },
  status:         { type: String, enum: ['pending', 'processing', 'completed', 'rejected'], default: 'pending' },
  adminNote:      { type: String },
  transactionRef: { type: String },
  resolvedAt:     { type: Date },
}, { timestamps: true });

withdrawalRequestSchema.index({ userId: 1, createdAt: -1 });
withdrawalRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);
