const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/review.controller');
const { protect } = require('../middlewares/auth.middleware');

router.get('/product/:productId', ctrl.getProductReviews);
router.post('/', protect, ctrl.createReview);
router.put('/:id', protect, ctrl.updateReview);
router.delete('/:id', protect, ctrl.deleteReview);

module.exports = router;
