const { Notification } = require('../models/index');
const { success, error, paginate } = require('../utils/response.utils');
const logger = require('../utils/logger');

let _io = null;
const setIO = (io) => { _io = io; };

// GET /api/notifications
const getNotifications = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const [total, items, unreadCount] = await Promise.all([
      Notification.countDocuments({ userId: req.user._id }),
      Notification.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Notification.countDocuments({ userId: req.user._id, isRead: false }),
    ]);
    return res.json({
      success: true,
      data: items,
      unreadCount,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) { next(err); }
};

// PUT /api/notifications/:id/read
const markRead = async (req, res, next) => {
  try {
    const updated = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    if (!updated) return error(res, 'Không tìm thấy thông báo', 404);
    return success(res, {}, 'Đã đánh dấu đã đọc');
  } catch (err) { next(err); }
};

// PUT /api/notifications/read-all
const markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    return success(res, {}, 'Đã đánh dấu tất cả đã đọc');
  } catch (err) { next(err); }
};

// GET /api/notifications/unread-count
const getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user._id, isRead: false });
    return success(res, { data: { count } });
  } catch (err) { next(err); }
};

// Helper: tạo notification + push real-time qua Socket.IO
const createNotification = async ({ userId, title, content, type = 'system', link, metadata }) => {
  try {
    const notif = await Notification.create({ userId, title, content, type, link, metadata });
    if (_io) {
      const unread = await Notification.countDocuments({ userId, isRead: false });
      _io.to(String(userId)).emit('new_notification', {
        notification: notif,
        unreadCount: unread,
      });
    }
  } catch (err) {
    logger.error(`[createNotification] ${err.message}`);
  }
};

module.exports = { getNotifications, markRead, markAllRead, getUnreadCount, createNotification, setIO };
