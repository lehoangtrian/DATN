const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/wishlist.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);
router.get('/', ctrl.getWishlist);
router.get('/check/:productId', ctrl.checkWishlist);
router.post('/:productId', ctrl.addToWishlist);
router.delete('/:productId', ctrl.removeFromWishlist);

module.exports = router;
