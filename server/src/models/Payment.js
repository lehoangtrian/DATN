const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  method: { type: String, enum: ['cod', 'bank_transfer', 'momo', 'zalopay', 'vnpay', 'wallet'], required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'success', 'failed', 'cancelled'], default: 'pending' },
  transactionId: { type: String },
  gateway: { type: String },
  gatewayResponse: { type: mongoose.Schema.Types.Mixed },
  paidAt: { type: Date },
  // Refund
  refundAmount: { type: Number, default: 0 },
  refundStatus: { type: String, enum: ['none', 'requested', 'processing', 'completed', 'rejected'], default: 'none' },
  refundMethod: { type: String },
  refundNote: { type: String },
  refundedAt: { type: Date },
}, { timestamps: true });

paymentSchema.index({ orderId: 1 });
paymentSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
