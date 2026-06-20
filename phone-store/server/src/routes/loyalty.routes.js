const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/loyalty.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

router.post('/redeem', ctrl.redeemPointsToCoupon);

module.exports = router;
