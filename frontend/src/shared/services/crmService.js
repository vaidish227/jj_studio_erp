import apiClient from './apiClient';

export const crmService = {
  // --- Leads (Enquiry) ---
  createLead: (leadData) => apiClient.post('/leads/createlead', leadData),
  getLeads: (params) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/leads/getlead${query ? `?${query}` : ''}`);
  },
  getLeadById: (id) => apiClient.get(`/leads/get/${id}`),
  updateLeadStatus: (id, status) =>
    apiClient.patch(`/leads/updatestatus/${id}`, { status }),
  updateLead: (id, data) => apiClient.put(`/leads/update/${id}`, data),
  convertLeadToClient: (id) => apiClient.post(`/leads/convert/${id}`),
  triggerThankYou: (id) => apiClient.post(`/leads/automation/thank-you/${id}`),
  updateShowProject: (id, data) => apiClient.patch(`/leads/show-project/${id}`, data),
  recordAdvancePayment: (id, data) =>
    apiClient.patch(`/leads/advance-payment/${id}`, data),

  // --- Clients (Information Form) ---
  createClient: (clientData) => apiClient.post('/clients/createclient', clientData),
  getClientById: (id) => apiClient.get(`/clients/get/${id}`),
  updateClient: (id, data) => apiClient.put(`/clients/update/${id}`, data),

  // --- Meetings ---
  createMeeting: (meetingData) => apiClient.post('/metting/create', meetingData),
  getMeetings: () => apiClient.get('/metting/get'),
  getMeetingsByLead: (leadId) => apiClient.get(`/metting/get/${leadId}`),
  updateMeeting: (id, data) => apiClient.put(`/metting/update/${id}`, data),

  // --- Follow-ups / KIT ---
  createFollowup: (followupData) => apiClient.post('/followups/create', followupData),
  getFollowups: () => apiClient.get('/followups/get'),
  getFollowupsByLead: (leadId) => apiClient.get(`/followups/get/${leadId}`),
  updateFollowup: (id, data) => apiClient.put(`/followups/update/${id}`, data),
  updateFollowupStatus: (id, status) =>
    apiClient.patch(`/followups/updatestatus/${id}`, { status }),

  // --- Proposals ---
  createProposal: (proposalData) => apiClient.post('/proposal/create', proposalData),
  getProposals: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/proposal/get${query ? `?${query}` : ''}`);
  },
  getProposalById: (id) => apiClient.get(`/proposal/get/${id}`),
  updateProposal: (id, data) => apiClient.put(`/proposal/update/${id}`, data),
  updateProposalStatus: (id, status) =>
    apiClient.patch(`/proposal/updatestatus/${id}`, { status }),
  sendProposal: (id) => apiClient.post(`/proposal/send/${id}`),
};
