import apiClient from './apiClient';

export const settingsService = {
  // ─── Roles ──────────────────────────────────────────────────────────────────
  getRoles: () => apiClient.get('/roles'),
  getRoleById: (id) => apiClient.get(`/roles/${id}`),
  createRole: (data) => apiClient.post('/roles', data),
  updateRole: (id, data) => apiClient.put(`/roles/${id}`, data),
  deleteRole: (id) => apiClient.delete(`/roles/${id}`),

  // ─── Permission definitions ──────────────────────────────────────────────────
  getAllPermissions: () => apiClient.get('/roles/permissions/all'),

  // ─── Users ──────────────────────────────────────────────────────────────────
  getUsers: () => apiClient.get('/roles/users/list'),
  updateUserRole: (userId, data) => apiClient.patch(`/roles/users/${userId}/role`, data),
};
