const mongoose = require('mongoose');

const returnRequestSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{
    orderItemId: { type: mongoose.Schema.Types.ObjectId },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: { type: Number, min: 1 },
    reason: String,
  }],
  reason: { type: String, required: true },
  description: { type: String },
  images: [{ type: String }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'processing', 'completed'],
    default: 'pending',
  },
  refundAmount: { type: Number, default: 0 },
  refundMethod: { type: String, enum: ['bank_transfer', 'cash', 'vnpay', 'wallet'] },
  refundBankInfo: {
    bankName:      { type: String },
    accountNumber: { type: String },
    accountHolder: { type: String },
  },
  refundRef:   { type: String }, // mã giao dịch hoàn tiền
  adminNote:   { type: String },
  resolvedAt:  { type: Date },
}, { timestamps: true });

returnRequestSchema.index({ userId: 1, createdAt: -1 });
returnRequestSchema.index({ status: 1, createdAt: -1 });
// Không dùng unique index trên orderId — user được phép tạo lại sau khi request bị rejected/completed
// Application-level check trong return.controller.js đã xử lý duplicate guard
returnRequestSchema.index({ orderId: 1 });

module.exports = mongoose.model('ReturnRequest', returnRequestSchema);
