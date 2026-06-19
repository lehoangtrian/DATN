import api from './axios';

export const getCart = () => api.get('/cart');
export const addCartItem = (variantId, quantity = 1) => api.post('/cart/items', { variantId, quantity });
export const updateCartItem = (variantId, quantity) => api.put(`/cart/items/${variantId}`, { quantity });
export const removeCartItem = (variantId) => api.delete(`/cart/items/${variantId}`);
export const clearCart = () => api.delete('/cart');
export const holdStock = (body = {}) => api.post('/cart/hold', body);
export const releaseHold = () => api.post('/cart/release');
