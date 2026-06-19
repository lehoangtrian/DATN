const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/profile.controller');
const { protect } = require('../middlewares/auth.middleware');
const { uploadAvatar } = require('../middlewares/upload.middleware');

router.use(protect);
router.get('/', ctrl.getProfile);
router.put('/', ctrl.updateProfile);
router.put('/change-password', ctrl.changePassword);
router.put('/avatar', uploadAvatar, ctrl.updateAvatar);
router.post('/addresses', ctrl.addAddress);
router.put('/addresses/:id', ctrl.updateAddress);
router.delete('/addresses/:id', ctrl.deleteAddress);

module.exports = router;
