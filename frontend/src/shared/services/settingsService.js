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
  // Structured Module → Section → Action catalogue for the Roles UI
  getRegistry: () => apiClient.get('/roles/registry'),
  // Curated role templates (permission bundles) for the Roles UI
  getPresets: () => apiClient.get('/roles/presets'),

  // ─── Users ──────────────────────────────────────────────────────────────────
  getUsers:          ()             => apiClient.get('/roles/users/list'),
  updateUserRole:    (userId, data) => apiClient.patch(`/roles/users/${userId}/role`, data),
  updateUser:              (userId, data) => apiClient.patch(`/roles/users/${userId}`, data),
  adminResetPassword:      (userId, data) => apiClient.post(`/roles/users/${userId}/reset-password`, data),
  getEffectivePermissions: (userId)       => apiClient.get(`/roles/users/${userId}/effective-permissions`),
};
