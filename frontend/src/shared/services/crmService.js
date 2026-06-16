import apiClient from './apiClient';
import { rangeToParams } from '../dashboard-filter/dateRangePresets';

// Legacy range tokens (Main Dashboard + back-compat) → ?range=…
const LEGACY_RANGE_TOKENS = ['3m', '6m', '1y'];

export const crmService = {
  // ─── Clients (Unified — Enquiry + Client Info) ─────────────────────
  // CREATE: Enquiry form creates a new CRMClient record
  createLead: (data) => apiClient.post('/clients/create', data),
  createClient: (data) => apiClient.post('/clients/create', data),

  // BULK IMPORT: CSV / Excel — body: { rows: [...] }
  bulkImportClients: (rows) => apiClient.post('/clients/bulk-import', { rows }),

  // CRM DASHBOARD: aggregated analytics for the dedicated CRM dashboard page.
  // Accepts a legacy string token ('3m'|'6m'|'1y') OR a range object {preset,from,to}.
  // Legacy tokens (incl. { preset:'3m' }) still hit ?range=… so Main Dashboard is unaffected.
  getCRMDashboard: (arg = '3m') => {
    const token = typeof arg === 'string' ? arg : arg?.preset;
    const params = LEGACY_RANGE_TOKENS.includes(token)
      ? { range: token }
      : rangeToParams(arg);
    return apiClient.get('/clients/dashboard', { params });
  },

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

  // INTERESTED: Mark client as interested (triggers proposal pipeline)
  markInterested: (id, note) =>
    apiClient.patch(`/leads/mark-interested/${id}`, { note }),

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
  // Capture outcome after a meeting — drives clientInterested → lifecycle transition
  completeMeeting: (id, outcomeData) =>
    apiClient.put(`/metting/update/${id}`, { status: 'completed', ...outcomeData }),

  // ─── Minutes of Meeting (MOM) ─────────────────────────────────────
  recordMOM: (id, momData) => apiClient.put(`/metting/mom/${id}`, momData),
  getMOM: (id) => apiClient.get(`/metting/mom/${id}`),

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
  downloadProposalPdf: (id) =>
    apiClient.get(`/proposal/pdf/${id}`, { responseType: 'blob' }),

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
