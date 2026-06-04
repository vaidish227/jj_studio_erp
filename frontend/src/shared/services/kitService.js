import apiClient from './apiClient';

// KIT (Keep In Touch) — communication automation engine API client.
// Phase 2 surface: template library + variable catalog + render preview.
export const kitService = {
  // ─── Templates ──────────────────────────────────────────────────────────────
  getTemplates: (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    ).toString();
    return apiClient.get(`/kit/templates${query ? `?${query}` : ''}`);
  },
  getTemplate:    (id)        => apiClient.get(`/kit/templates/${id}`),
  createTemplate: (data)      => apiClient.post('/kit/templates', data),
  updateTemplate: (id, data)  => apiClient.put(`/kit/templates/${id}`, data),
  deleteTemplate: (id)        => apiClient.delete(`/kit/templates/${id}`),

  // ─── Variable catalog + render preview ───────────────────────────────────────
  getVariables: (entity)      => apiClient.get(`/kit/templates/variables${entity ? `?entity=${entity}` : ''}`),
  preview:      (data)        => apiClient.post('/kit/templates/preview', data),

  // ─── Campaigns ────────────────────────────────────────────────────────────────
  getCampaigns:    (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    ).toString();
    return apiClient.get(`/kit/campaigns${query ? `?${query}` : ''}`);
  },
  getCampaign:     (id)       => apiClient.get(`/kit/campaigns/${id}`),
  createCampaign:  (data)     => apiClient.post('/kit/campaigns', data),
  updateCampaign:  (id, data) => apiClient.put(`/kit/campaigns/${id}`, data),
  deleteCampaign:  (id)       => apiClient.delete(`/kit/campaigns/${id}`),

  // Steps
  addStep:     (id, data)         => apiClient.post(`/kit/campaigns/${id}/steps`, data),
  updateStep:  (id, stepId, data) => apiClient.put(`/kit/campaigns/${id}/steps/${stepId}`, data),
  deleteStep:  (id, stepId)       => apiClient.delete(`/kit/campaigns/${id}/steps/${stepId}`),
  reorderSteps:(id, order)        => apiClient.put(`/kit/campaigns/${id}/steps/reorder`, { order }),

  // Enrollment
  enroll:         (id, data)      => apiClient.post(`/kit/campaigns/${id}/enroll`, data),
  getEnrollments: (params = {})   => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    ).toString();
    return apiClient.get(`/kit/enrollments${query ? `?${query}` : ''}`);
  },
  stopEnrollment: (id)            => apiClient.post(`/kit/enrollments/${id}/stop`),

  // ─── Workflows (automation) ───────────────────────────────────────────────────
  getTriggerCatalog: ()        => apiClient.get('/kit/triggers/catalog'),
  getWorkflows:      ()        => apiClient.get('/kit/workflows'),
  getWorkflow:       (id)      => apiClient.get(`/kit/workflows/${id}`),
  createWorkflow:    (data)    => apiClient.post('/kit/workflows', data),
  updateWorkflow:    (id, data)=> apiClient.put(`/kit/workflows/${id}`, data),
  toggleWorkflow:    (id)      => apiClient.post(`/kit/workflows/${id}/toggle`),
  deleteWorkflow:    (id)      => apiClient.delete(`/kit/workflows/${id}`),

  // ─── Communication settings (quiet-hours window + rate limit per channel) ─────
  getCommSettings:    (channel)       => apiClient.get(`/communication/settings/${channel}`),
  updateCommSettings: (channel, data) => apiClient.patch(`/communication/settings/${channel}`, data),
};

export default kitService;
