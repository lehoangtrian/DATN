import api from './axios';
export const getProfile = () => api.get('/profile');
export const updateProfile = (data) => api.put('/profile', data);
export const changePassword = (data) => api.put('/profile/change-password', data);
export const uploadAvatar = (formData) => api.put('/profile/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const addAddress = (data) => api.post('/profile/addresses', data);
export const updateAddress = (id, data) => api.put(`/profile/addresses/${id}`, data);
export const deleteAddress = (id) => api.delete(`/profile/addresses/${id}`);
