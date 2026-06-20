const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/order.controller');
const { protect } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const v = require('../validations/order.validation');

router.use(protect);

router.post('/', validate(v.createOrder), ctrl.createOrder);
router.get('/', ctrl.getMyOrders);
router.get('/:id', ctrl.getOrderById);
router.put('/:id/cancel', ctrl.cancelOrder);

module.exports = router;
