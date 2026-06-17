import apiClient from '../../../shared/services/apiClient';

const base = '/departments';

export const departmentService = {
  list: (params) => apiClient.get(base, { params }),
  create: (data) => apiClient.post(base, data),
  update: (id, data) => apiClient.patch(`${base}/${id}`, data),
  remove: (id, params) => apiClient.delete(`${base}/${id}`, { params }),
};

export default departmentService;
