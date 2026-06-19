const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/chat.controller');
const { protect } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

// Public
router.get('/admin-status', ctrl.getAdminStatus);

// User endpoints (protected)
router.get('/history', protect, ctrl.getHistory);
router.post('/close', protect, ctrl.closeSession);

// Admin endpoints
const adminOnly = [protect, requireRole('admin', 'staff')];
router.get('/sessions', ...adminOnly, ctrl.getSessions);
router.get('/sessions/:id/messages', ...adminOnly, ctrl.getSessionMessages);
router.put('/sessions/:id/assign', ...adminOnly, ctrl.assignSession);
router.put('/sessions/:id/close', ...adminOnly, ctrl.adminCloseSession);

module.exports = router;
