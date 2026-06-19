const mongoose = require('mongoose');

const topupRequestSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount:      { type: Number, required: true, min: 10000 },
  ref:         { type: String, required: true, unique: true }, // NAP-XXXX-timestamp
  status:      { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  note:        { type: String },
  confirmedAt: { type: Date },
}, { timestamps: true });

topupRequestSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('TopupRequest', topupRequestSchema);
