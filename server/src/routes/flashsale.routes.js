const router = require('express').Router();
const ctrl = require('../controllers/flashsale.controller');
const { protect } = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/role.middleware');

// Public
router.get('/', ctrl.getActiveFlashSales);
router.get('/active-categories', ctrl.getActiveCategoryFlashSales);
router.get('/variant/:variantId', ctrl.getFlashSaleByVariant);

// Admin (admin bypasses automatically, staff needs manage_flash_sales)
router.get('/admin',       protect, requirePermission('manage_flash_sales'), ctrl.adminGetFlashSales);
router.post('/admin',      protect, requirePermission('manage_flash_sales'), ctrl.adminCreateFlashSale);
router.put('/admin/:id',   protect, requirePermission('manage_flash_sales'), ctrl.adminUpdateFlashSale);
router.delete('/admin/:id',protect, requirePermission('manage_flash_sales'), ctrl.adminDeleteFlashSale);

module.exports = router;
