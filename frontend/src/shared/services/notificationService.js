import apiClient from './apiClient';

// REST wrappers for /api/notifications. Pass-through — no transformation.
export const notificationService = {
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ).toString();
    return apiClient.get(`/notifications${qs ? `?${qs}` : ''}`);
  },

  unreadCount: () => apiClient.get('/notifications/count'),

  markAsRead: (id) => apiClient.patch(`/notifications/${id}/read`),

  markAllAsRead: () => apiClient.patch('/notifications/read-all'),

  dismiss: (id) => apiClient.delete(`/notifications/${id}`),
};

export default notificationService;
