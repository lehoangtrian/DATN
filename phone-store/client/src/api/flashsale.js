import api from './axios';

export const getActiveFlashSales = () => api.get('/flash-sales');
export const getActiveCategoryFlashSales = () => api.get('/flash-sales/active-categories');
export const getFlashSaleByVariant = (variantId) => api.get(`/flash-sales/variant/${variantId}`);
export const adminGetFlashSales = (params) => api.get('/flash-sales/admin', { params });
export const adminCreateFlashSale = (data) => api.post('/flash-sales/admin', data);
export const adminUpdateFlashSale = (id, data) => api.put(`/flash-sales/admin/${id}`, data);
export const adminDeleteFlashSale = (id) => api.delete(`/flash-sales/admin/${id}`);
