import apiClient from '../../../shared/services/apiClient';

const base = '/delegations';

// apiClient's response interceptor returns response.data, so every method
// resolves to the JSON body directly.
export const delegationService = {
  list: (params) => apiClient.get(base, { params }),
  get: (id) => apiClient.get(`${base}/${id}`),
  create: (data) => apiClient.post(base, data),
  update: (id, data) => apiClient.patch(`${base}/${id}`, data),
  remove: (id) => apiClient.delete(`${base}/${id}`),

  assign: (id, data) => apiClient.patch(`${base}/${id}/assign`, data),
  reassign: (id, data) => apiClient.patch(`${base}/${id}/reassign`, data),
  changeStatus: (id, data) => apiClient.patch(`${base}/${id}/status`, data),
  updateChecklist: (id, data) => apiClient.patch(`${base}/${id}/checklist`, data),

  listComments: (id) => apiClient.get(`${base}/${id}/comments`),
  addComment: (id, data) => apiClient.post(`${base}/${id}/comments`, data),

  addAttachment: (id, formData) =>
    apiClient.post(`${base}/${id}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  attachmentUrl: (id, attId) => apiClient.get(`${base}/${id}/attachments/${attId}/url`),
  removeAttachment: (id, attId) => apiClient.delete(`${base}/${id}/attachments/${attId}`),

  activity: (id) => apiClient.get(`${base}/${id}/activity`),
  dashboard: () => apiClient.get(`${base}/dashboard`),
  assignees: () => apiClient.get(`${base}/assignees`),
};

export default delegationService;
