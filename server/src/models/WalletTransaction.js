const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:         { type: String, enum: ['topup', 'payment', 'refund', 'adjustment'], required: true },
  amount:       { type: Number, required: true }, // dương = nhận vào, âm = trừ ra
  balanceAfter: { type: Number, required: true }, // số dư sau giao dịch
  orderId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  returnId:     { type: mongoose.Schema.Types.ObjectId, ref: 'ReturnRequest' },
  description:  { type: String },
  ref:          { type: String }, // mã tham chiếu ngoài
}, { timestamps: true });

walletTransactionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
