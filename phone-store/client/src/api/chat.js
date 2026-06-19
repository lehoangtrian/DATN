import api from './axios';

export const getAdminStatus = () => api.get('/chat/admin-status');
export const getChatHistory = (params) => api.get('/chat/history', { params });
export const closeChatSession = () => api.post('/chat/close');

// Admin
export const getChatSessions = (params) => api.get('/chat/sessions', { params });
export const getSessionMessages = (id) => api.get(`/chat/sessions/${id}/messages`);
export const assignChatSession = (id) => api.put(`/chat/sessions/${id}/assign`);
export const adminCloseSession = (id) => api.put(`/chat/sessions/${id}/close`);
