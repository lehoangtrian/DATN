const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/coupon.controller');
const { protect } = require('../middlewares/auth.middleware');
const { optionalAuth } = require('../middlewares/auth.middleware');

router.get('/', optionalAuth, ctrl.getActiveCoupons);
router.post('/validate', protect, ctrl.validateCoupon);

module.exports = router;
