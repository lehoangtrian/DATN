import api from './axios';
export const createVNPayPaymentUrl = (orderId) => api.post('/payments/vnpay/create', { orderId });
export const getPaymentStatus = (orderId) => api.get(`/payments/status/${orderId}`);
