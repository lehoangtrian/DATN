const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  type: {
    type: String,
    enum: ['order', 'promotion', 'system', 'warranty', 'return', 'flash_sale'],
    default: 'system',
  },
  channel: { type: String, enum: ['web', 'email', 'sms', 'push'], default: 'web' },
  isRead: { type: Boolean, default: false },
  readAt: { type: Date },
  link: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
