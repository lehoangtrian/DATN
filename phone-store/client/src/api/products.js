import api from './axios';

export const getProducts = (params) => api.get('/products', { params });
export const getProductBySlug = (slug) => api.get(`/products/${slug}`);
export const getFeaturedProducts = () => api.get('/products/featured');
export const searchProducts = (q, limit = 20) => api.get('/products/search', { params: { q, limit } });
export const getProductsByBrand = (brand, params) => api.get('/products', { params: { brand, ...params } });
export const compareProducts = (ids) => api.get('/products/compare', { params: { ids: ids.join(',') } });
export const getRelatedProducts = (id) => api.get(`/products/${id}/related`);
export const getBrands = () => api.get('/brands');
export const getCategories = () => api.get('/categories');
export const notifyWhenInStock = (variantId) => api.post(`/products/${variantId}/notify-stock`);
