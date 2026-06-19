import api from './axios';
export const validateCoupon = (code, cartTotal) => api.post('/coupons/validate', { code, cartTotal });
export const getActiveCoupons = () => api.get('/coupons');
