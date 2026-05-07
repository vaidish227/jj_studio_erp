import apiClient from './apiClient';

export const crmService = {
  // ─── Clients (Unified — Enquiry + Client Info) ─────────────────────
  // CREATE: Enquiry form creates a new CRMClient record
  createLead: (data) => apiClient.post('/clients/create', data),
  createClient: (data) => apiClient.post('/clients/create', data),

  // READ: List clients (with optional filters)
  getLeads: (params) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/clients/get${query ? `?${query}` : ''}`);
  },

  // READ: Get single client by ID
  getLeadById: (id) => apiClient.get(`/clients/get/${id}`),
  getClientById: (id) => apiClient.get(`/clients/get/${id}`),

  // UPDATE: Enrich client details (Client Info Form)
  updateClient: (id, data) => apiClient.put(`/clients/update/${id}`, data),
  updateLead: (id, data) => apiClient.put(`/clients/update/${id}`, data),

  // STATUS: Combined status + lifecycle update (single API call)
  updateLeadStatus: (id, status) =>
    apiClient.patch(`/clients/status/${id}`, { status }),
  updateClientStatus: (id, statusData) =>
    apiClient.patch(`/clients/status/${id}`, statusData),

  // CONVERT: Mark client as converted
  convertLeadToClient: (id) => apiClient.post(`/leads/convert/${id}`),

  // AUTOMATION
  triggerThankYou: (id) => apiClient.post(`/leads/automation/thank-you/${id}`),
  updateShowProject: (id, data) => apiClient.patch(`/leads/show-project/${id}`, data),
  recordAdvancePayment: (id, data) =>
    apiClient.patch(`/leads/advance-payment/${id}`, data),

  // TIMELINE
  appendTimelineEvent: (id, data) =>
    apiClient.post(`/clients/timeline/${id}`, data),

  // ─── Meetings ──────────────────────────────────────────────────────
  createMeeting: (meetingData) => apiClient.post('/metting/create', meetingData),
  getMeetings: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/metting/get${query ? `?${query}` : ''}`);
  },
  getMeetingsByLead: (leadId) => apiClient.get(`/metting/get/${leadId}`),
  updateMeeting: (id, data) => apiClient.put(`/metting/update/${id}`, data),

  // ─── Follow-ups / KIT ─────────────────────────────────────────────
  createFollowup: (followupData) => apiClient.post('/followup/create', followupData),
  getFollowups: () => apiClient.get('/followup/get'),
  getFollowupsByLead: (leadId) => apiClient.get(`/followup/get/${leadId}`),
  updateFollowup: (id, data) => apiClient.put(`/followup/update/${id}`, data),
  updateFollowupStatus: (id, status) =>
    apiClient.patch(`/followup/updatestatus/${id}`, { status }),

  // ─── Proposals ─────────────────────────────────────────────────────
  createProposal: (proposalData) => apiClient.post('/proposal/create', proposalData),
  getProposals: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/proposal/get${query ? `?${query}` : ''}`);
  },
  getProposalById: (id) => apiClient.get(`/proposal/get/${id}`),
  updateProposal: (id, data) => apiClient.put(`/proposal/update/${id}`, data),
  updateProposalStatus: (id, data) =>
    apiClient.patch(`/proposal/updatestatus/${id}`, data),
  sendProposal: (id) => apiClient.post(`/proposal/send/${id}`),

  // ─── Templates ─────────────────────────────────────────────────────
  createTemplate: (data) => apiClient.post('/Template/create', data),
  getTemplates: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/Template/get${query ? `?${query}` : ''}`);
  },
  getTemplateById: (id) => apiClient.get(`/Template/getbyid/${id}`),
  updateTemplate: (id, data) => apiClient.put(`/Template/update/${id}`, data),
  deleteTemplate: (id) => apiClient.delete(`/Template/delete/${id}`),
};
