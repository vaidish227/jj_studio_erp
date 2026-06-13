import apiClient from '../../../shared/services/apiClient';

export const conversationsService = {
  list:    (params = {}) => apiClient.get('/ai/conversations', { params }),
  getOne:  (id)          => apiClient.get(`/ai/conversations/${id}`),
  rename:  (id, title)   => apiClient.post(`/ai/conversations/${id}/rename`, { title }),
  remove:  (id)          => apiClient.delete(`/ai/conversations/${id}`),
  feedback: (messageId, rating, reason) =>
    apiClient.post('/ai/feedback', { messageId, rating, reason }),
};

export default conversationsService;
