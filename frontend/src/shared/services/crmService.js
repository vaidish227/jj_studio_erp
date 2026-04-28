import apiClient from './apiClient';

export const crmService = {
  // --- Leads (Enquiry) ---
  createLead: (leadData) => {
    return apiClient('/leads/createlead', { body: leadData });
  },
  getLeads: (params) => {
    const query = new URLSearchParams(params).toString();
    return apiClient(`/leads/getlead?${query}`);
  },
  getLeadById: (id) => {
    return apiClient(`/leads/get/${id}`);
  },
  updateLeadStatus: (id, status) => {
    return apiClient(`/leads/updatestatus/${id}`, { 
      method: 'PATCH',
      body: { status } 
    });
  },
  updateLead: (id, data) => {
    return apiClient(`/leads/update/${id}`, {
      method: 'PUT',
      body: data
    });
  },

  // --- Clients (Information Form) ---
  createClient: (clientData) => {
    return apiClient('/clients/createclient', { body: clientData });
  },
  getClientById: (id) => {
    return apiClient(`/clients/getclient/${id}`);
  },

  // --- Meetings ---
  createMeeting: (meetingData) => {
    return apiClient('/metting/create', { body: meetingData });
  },
  getMeetings: () => {
    return apiClient('/metting/get');
  },

  // --- Proposals ---
  createProposal: (proposalData) => {
    return apiClient('/proposal/create', { body: proposalData });
  },
  updateProposalStatus: (id, status) => {
    return apiClient(`/proposal/updatestatus/${id}`, {
      method: 'PATCH',
      body: { status }
    });
  }
};
