import api from './axios';

export const redeemPointsToCoupon = (points) => api.post('/loyalty/redeem', { points });
