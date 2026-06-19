const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/cart.controller');
const { protect } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { addItem, updateItem } = require('../validations/cart.validation');

router.use(protect);

router.get('/', ctrl.getCart);
router.post('/items', validate(addItem), ctrl.addItem);
router.put('/items/:variantId', validate(updateItem), ctrl.updateItem);
router.delete('/items/:variantId', ctrl.removeItem);
router.delete('/', ctrl.clearCart);
router.post('/hold', ctrl.holdStock);
router.post('/release', ctrl.releaseHold);

module.exports = router;
