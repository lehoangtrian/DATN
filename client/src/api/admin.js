import api from './axios';

export const getDashboard = () => api.get('/admin/dashboard');
export const getAnalytics = (period) => api.get('/admin/analytics', { params: { period } });

// Products
export const getAdminProducts = (params) => api.get('/admin/products', { params });
export const createAdminProduct = (data) => api.post('/admin/products', data);
export const updateAdminProduct = (id, data) => api.put(`/admin/products/${id}`, data);
export const deleteAdminProduct = (id) => api.delete(`/admin/products/${id}`);
export const exportAdminProductsCsv = () => api.get('/admin/products/export', { responseType: 'blob' });
export const importAdminProductsCsv = (data) => api.post('/admin/products/import', data);
export const uploadAdminProductImage = (formData) => api.post('/admin/upload-image', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

// Variants
export const createAdminVariant = (productId, data) => api.post(`/admin/products/${productId}/variants`, data);
export const updateVariant = (productId, variantId, data) => api.put(`/admin/products/${productId}/variants/${variantId}`, data);
export const deleteAdminVariant = (productId, variantId) => api.delete(`/admin/products/${productId}/variants/${variantId}`);

// Categories
export const getAdminCategories = () => api.get('/admin/categories');
export const createAdminCategory = (data) => api.post('/admin/categories', data);
export const updateAdminCategory = (id, data) => api.put(`/admin/categories/${id}`, data);
export const deleteAdminCategory = (id) => api.delete(`/admin/categories/${id}`);

// Orders
export const getAdminOrders = (params) => api.get('/admin/orders', { params });
export const updateOrderStatus = (id, data) => api.put(`/admin/orders/${id}/status`, data);

// Users
export const getAdminUsers = (params) => api.get('/admin/users', { params });
export const toggleUserStatus = (id) => api.put(`/admin/users/${id}/toggle`);
export const deleteAdminUser = (id) => api.delete(`/admin/users/${id}`);
export const updateUserRole = (id, role) => api.put(`/admin/users/${id}/role`, { role });
export const updateUserPermissions = (id, permissions) => api.put(`/admin/users/${id}/permissions`, { permissions });

// Coupons
export const getAdminCoupons = () => api.get('/admin/coupons');
export const createCoupon = (data) => api.post('/admin/coupons', data);
export const updateCoupon = (id, data) => api.put(`/admin/coupons/${id}`, data);
export const deleteCoupon = (id) => api.delete(`/admin/coupons/${id}`);

// Reviews
export const getAdminReviews = (params) => api.get('/admin/reviews', { params });
export const updateAdminReview = (id, data) => api.put(`/admin/reviews/${id}`, data);
export const toggleReview = (id) => api.put(`/admin/reviews/${id}/toggle`);
export const replyReview = (id, reply) => api.put(`/admin/reviews/${id}/reply`, { reply });

// Returns
export const getAdminReturns = (params) => api.get('/admin/returns', { params });
export const updateAdminReturn = (id, data) => api.put(`/admin/returns/${id}`, data);
