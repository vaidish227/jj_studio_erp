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
};

export default kitService;
