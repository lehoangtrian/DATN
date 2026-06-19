const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/return.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

router.post('/', ctrl.createReturn);
router.get('/', ctrl.getMyReturns);
router.get('/order/:orderId', ctrl.getReturnByOrder);
router.get('/:id', ctrl.getReturnById);

module.exports = router;
