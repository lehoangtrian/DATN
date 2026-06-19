const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/admin.controller');
const walletCtrl = require('../controllers/wallet.controller');
const bannerCtrl = require('../controllers/banner.controller');
const { protect } = require('../middlewares/auth.middleware');
const { requireRole, requirePermission } = require('../middlewares/role.middleware');
const { uploadProductImage } = require('../middlewares/upload.middleware');

// Base: admin hoặc staff đều qua được router level
router.use(protect, requireRole('admin', 'staff'));

router.get('/dashboard', ctrl.getDashboard);
router.get('/analytics', requirePermission('manage_orders'), ctrl.getAnalytics);

// Products + Categories
router.get('/products',                             requirePermission('manage_products'), ctrl.getProducts);
router.post('/products',                            requirePermission('manage_products'), ctrl.createProduct);
router.get('/products/export',                      requirePermission('manage_products'), ctrl.exportProductsCsv);
router.post('/products/import',                     requirePermission('manage_products'), ctrl.importProductsCsv);
router.post('/upload-image',                        requirePermission('manage_products'), uploadProductImage, ctrl.uploadProductImage);
router.put('/products/:id',                         requirePermission('manage_products'), ctrl.updateProduct);
router.delete('/products/:id',                      requirePermission('manage_products'), ctrl.deleteProduct);
router.post('/products/:id/variants',               requirePermission('manage_products'), ctrl.createVariant);
router.put('/products/:id/variants/:variantId',     requirePermission('manage_products'), ctrl.updateVariant);
router.delete('/products/:id/variants/:variantId',  requirePermission('manage_products'), ctrl.deleteVariant);

router.get('/categories',     requirePermission('manage_products'), ctrl.getCategories);
router.post('/categories',    requirePermission('manage_products'), ctrl.createCategory);
router.put('/categories/:id', requirePermission('manage_products'), ctrl.updateCategory);
router.delete('/categories/:id', requirePermission('manage_products'), ctrl.deleteCategory);

// Orders
router.get('/orders',              requirePermission('manage_orders'), ctrl.getOrders);
router.put('/orders/:id/status',   requirePermission('manage_orders'), ctrl.updateOrderStatus);

// Users — view + toggle: manage_users; delete + role/perms: admin only
router.get('/users',                 requirePermission('manage_users'), ctrl.getUsers);
router.put('/users/:id/toggle',      requirePermission('manage_users'), ctrl.toggleUserStatus);
router.delete('/users/:id',          requireRole('admin'), ctrl.deleteUser);
router.put('/users/:id/role',        requireRole('admin'), ctrl.updateUserRole);
router.put('/users/:id/permissions', requireRole('admin'), ctrl.updateUserPermissions);

// Coupons
router.get('/coupons',        requirePermission('manage_coupons'), ctrl.getCoupons);
router.post('/coupons',       requirePermission('manage_coupons'), ctrl.createCoupon);
router.put('/coupons/:id',    requirePermission('manage_coupons'), ctrl.updateCoupon);
router.delete('/coupons/:id', requirePermission('manage_coupons'), ctrl.deleteCoupon);

// Reviews
router.get('/reviews',             requirePermission('manage_reviews'), ctrl.getReviews);
router.put('/reviews/:id',         requirePermission('manage_reviews'), ctrl.updateAdminReview);
router.put('/reviews/:id/toggle',  requirePermission('manage_reviews'), ctrl.toggleReviewApproval);
router.put('/reviews/:id/reply',   requirePermission('manage_reviews'), ctrl.replyToReview);

// Returns
router.get('/returns',     requirePermission('manage_returns'), ctrl.getReturnRequests);
router.put('/returns/:id', requirePermission('manage_returns'), ctrl.updateReturnRequest);

// Wallet — admin only
router.post('/wallet/topup',             requireRole('admin'), walletCtrl.adminTopup);
router.get('/wallet/topups',             requireRole('admin'), ctrl.getTopupRequests);
router.put('/wallet/topups/:id/confirm', requireRole('admin'), ctrl.confirmTopup);
router.get('/wallet/withdrawals',        requireRole('admin'), ctrl.getWithdrawalRequests);
router.put('/wallet/withdrawals/:id',    requireRole('admin'), ctrl.processWithdrawal);

// Banners
router.get('/banners',          requirePermission('manage_banners'), bannerCtrl.adminGetBanners);
router.post('/banners',         requirePermission('manage_banners'), bannerCtrl.adminCreateBanner);
router.put('/banners/:id',      requirePermission('manage_banners'), bannerCtrl.adminUpdateBanner);
router.delete('/banners/:id',   requirePermission('manage_banners'), bannerCtrl.adminDeleteBanner);

// Service badges
router.get('/service-badges',           requirePermission('manage_banners'), bannerCtrl.adminGetServiceBadges);
router.post('/service-badges',          requirePermission('manage_banners'), bannerCtrl.adminCreateServiceBadge);
router.put('/service-badges/:id',       requirePermission('manage_banners'), bannerCtrl.adminUpdateServiceBadge);
router.delete('/service-badges/:id',    requirePermission('manage_banners'), bannerCtrl.adminDeleteServiceBadge);

module.exports = router;
