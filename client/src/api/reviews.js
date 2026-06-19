import api from './axios';
export const getProductReviews = (productId, params) => api.get(`/reviews/product/${productId}`, { params });
export const createReview = (data) => api.post('/reviews', data);
export const updateReview = (id, data) => api.put(`/reviews/${id}`, data);
export const deleteReview = (id) => api.delete(`/reviews/${id}`);
