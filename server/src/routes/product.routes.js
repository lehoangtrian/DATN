const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/product.controller');
const { protect } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { listProducts, compareProducts } = require('../validations/product.validation');

// Thứ tự quan trọng: route cụ thể trước route có param
router.get('/featured', ctrl.getFeatured);
router.get('/search', ctrl.searchProducts);
router.get('/compare', validate(compareProducts, 'query'), ctrl.compareProducts);
router.get('/', validate(listProducts, 'query'), ctrl.listProducts);
router.get('/:slug', ctrl.getProductBySlug);
router.get('/:id/related', ctrl.getRelated);
router.post('/:variantId/notify-stock', protect, ctrl.notifyStock);

module.exports = router;
