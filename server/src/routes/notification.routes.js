const router = require('express').Router();
const ctrl = require('../controllers/notification.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);
router.get('/', ctrl.getNotifications);
router.get('/unread-count', ctrl.getUnreadCount);
router.put('/read-all', ctrl.markAllRead);
router.put('/:id/read', ctrl.markRead);

module.exports = router;
