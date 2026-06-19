import api from './axios';

export const getWalletBalance = () => api.get('/wallet/balance');
export const getWalletTransactions = (params) => api.get('/wallet/transactions', { params });

// Top-up
export const requestBankTopup = (data) => api.post('/wallet/topup/bank', data);
export const getMyTopups = () => api.get('/wallet/topups');

// Withdrawal
export const requestWithdrawal = (data) => api.post('/wallet/withdraw', data);
export const getMyWithdrawals = () => api.get('/wallet/withdrawals');

// Admin
export const adminTopupWallet = (data) => api.post('/admin/wallet/topup', data);
export const getAdminTopups = (params) => api.get('/admin/wallet/topups', { params });
export const confirmAdminTopup = (id) => api.put(`/admin/wallet/topups/${id}/confirm`);
export const getAdminWithdrawals = (params) => api.get('/admin/wallet/withdrawals', { params });
export const processAdminWithdrawal = (id, data) => api.put(`/admin/wallet/withdrawals/${id}`, data);
