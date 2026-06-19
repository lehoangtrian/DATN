const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/order.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

router.post('/', ctrl.createOrder);
router.get('/', ctrl.getMyOrders);
router.get('/:id', ctrl.getOrderById);
router.put('/:id/cancel', ctrl.cancelOrder);

module.exports = router;
