const mongoose = require('mongoose');

const chatSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['bot', 'open', 'closed'], default: 'bot' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lastMessageAt: { type: Date, default: Date.now },
    unreadByAdmin: { type: Number, default: 0 },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

chatSessionSchema.index({ userId: 1 });
chatSessionSchema.index({ status: 1, lastMessageAt: -1 });
chatSessionSchema.index({ assignedTo: 1, status: 1 });

module.exports = mongoose.model('ChatSession', chatSessionSchema);
