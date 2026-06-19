const mongoose = require('mongoose');

const actionSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    type: { type: String, required: true }, // 'navigate' | 'trigger_intent'
    payload: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const chatMessageSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatSession', required: true },
    sender: { type: String, enum: ['user', 'admin', 'bot'], required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    text: { type: String, required: true, trim: true },
    actions: { type: [actionSchema], default: [] },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

chatMessageSchema.index({ sessionId: 1, createdAt: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
