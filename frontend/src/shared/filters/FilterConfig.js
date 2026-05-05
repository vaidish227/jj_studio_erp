/**
 * Centralized filter configuration for the entire ERP system
 * Defines available filters for each module and their options
 */

export const FILTER_TYPES = {
  SEARCH: 'search',
  SORT_ALPHABET: 'sort_alphabet',
  SORT_DATE: 'sort_date',
  STATUS: 'status',
  CATEGORY: 'category',
  DATE_RANGE: 'date_range',
  PRIORITY: 'priority',
  AMOUNT: 'amount'
};

export const SORT_OPTIONS = {
  ALPHABET_ASC: { value: 'alpha_asc', label: 'A → Z', field: 'name', direction: 1 },
  ALPHABET_DESC: { value: 'alpha_desc', label: 'Z → A', field: 'name', direction: -1 },
  DATE_NEWEST: { value: 'date_newest', label: 'Newest First', field: 'createdAt', direction: -1 },
  DATE_OLDEST: { value: 'date_oldest', label: 'Oldest First', field: 'createdAt', direction: 1 }
};

// CRM Module Filters - Context-aware configurations
export const CRM_FILTERS = {
  // New Leads Page - Lead focused filters
  leads: {
    [FILTER_TYPES.SEARCH]: {
      placeholder: 'Search by client name, phone, email, city...',
      fields: ['name', 'phone', 'email', 'city', 'projectType']
    },
    [FILTER_TYPES.SORT_ALPHABET]: true,
    [FILTER_TYPES.SORT_DATE]: true,
    [FILTER_TYPES.STATUS]: {
      options: [
        { value: 'new', label: 'New Lead', color: 'blue' },
        { value: 'contacted', label: 'Contacted', color: 'yellow' },
        { value: 'meeting_done', label: 'Meeting Done', color: 'purple' },
        { value: 'proposal_sent', label: 'Proposal Sent', color: 'orange' },
        { value: 'converted', label: 'Converted', color: 'green' },
        { value: 'lost', label: 'Lost', color: 'red' }
      ]
    },
    [FILTER_TYPES.CATEGORY]: {
      label: 'Project Type',
      options: [
        { value: 'Residential', label: 'Residential' },
        { value: 'Commercial', label: 'Commercial' }
      ]
    },
    [FILTER_TYPES.DATE_RANGE]: {
      label: 'Lead Date',
      field: 'createdAt'
    }
  },
  // Meetings Page - Meeting focused filters
  meetings: {
    [FILTER_TYPES.SEARCH]: {
      placeholder: 'Search by client name, meeting type, notes...',
      fields: ['leadId.name', 'leadId.phone', 'leadId.projectType', 'type', 'notes', 'status']
    },
    [FILTER_TYPES.SORT_DATE]: true,
    [FILTER_TYPES.STATUS]: {
      options: [
        { value: 'scheduled', label: 'Scheduled', color: 'blue' },
        { value: 'completed', label: 'Completed', color: 'green' },
        { value: 'cancelled', label: 'Cancelled', color: 'red' }
      ]
    },
    [FILTER_TYPES.CATEGORY]: {
      label: 'Meeting Type',
      options: [
        { value: 'office', label: 'Office Meeting' },
        { value: 'site', label: 'Site Visit' },
        { value: 'call', label: 'Phone Call' },
        { value: 'video', label: 'Video Call' }
      ]
    },
    [FILTER_TYPES.DATE_RANGE]: {
      label: 'Meeting Date',
      field: 'date'
    }
  },
  // Follow-ups Page - Follow-up focused filters
  followups: {
    [FILTER_TYPES.SEARCH]: {
      placeholder: 'Search by client name, phone, email...',
      fields: ['name', 'phone', 'email', 'city', 'projectType']
    },
    [FILTER_TYPES.SORT_DATE]: true,
    [FILTER_TYPES.STATUS]: {
      options: [
        { value: 'new', label: 'New Lead', color: 'blue' },
        { value: 'contacted', label: 'Contacted', color: 'yellow' },
        { value: 'meeting_done', label: 'Meeting Done', color: 'purple' },
        { value: 'proposal_sent', label: 'Proposal Sent', color: 'orange' },
        { value: 'converted', label: 'Converted', color: 'green' },
        { value: 'lost', label: 'Lost', color: 'red' }
      ]
    },
    [FILTER_TYPES.CATEGORY]: {
      label: 'Project Type',
      options: [
        { value: 'Residential', label: 'Residential' },
        { value: 'Commercial', label: 'Commercial' }
      ]
    },
    [FILTER_TYPES.DATE_RANGE]: {
      label: 'Follow-up Date',
      field: 'followUpDate'
    }
  },
  // Converted/Won Leads Page - Conversion focused filters
  converted: {
    [FILTER_TYPES.SEARCH]: {
      placeholder: 'Search by client name, phone, project...',
      fields: ['name', 'phone', 'email', 'city', 'projectType']
    },
    [FILTER_TYPES.SORT_DATE]: true,
    [FILTER_TYPES.CATEGORY]: {
      label: 'Project Type',
      options: [
        { value: 'Residential', label: 'Residential' },
        { value: 'Commercial', label: 'Commercial' }
      ]
    },
    [FILTER_TYPES.DATE_RANGE]: {
      label: 'Conversion Date',
      field: 'convertedAt'
    },
    [FILTER_TYPES.AMOUNT]: {
      label: 'Project Value',
      field: 'projectValue'
    }
  },
  // Keep In Touch Page - Nurture focused filters
  kit: {
    [FILTER_TYPES.SEARCH]: {
      placeholder: 'Search by client name, phone, project...',
      fields: ['name', 'phone', 'email', 'city', 'projectType']
    },
    [FILTER_TYPES.SORT_DATE]: true,
    [FILTER_TYPES.STATUS]: {
      options: [
        { value: 'qualified', label: 'Qualified', color: 'green' },
        { value: 'in_review', label: 'In Review', color: 'yellow' },
        { value: 'hot_lead', label: 'Hot Lead', color: 'red' },
        { value: 'follow_up', label: 'Follow Up Required', color: 'blue' }
      ]
    },
    [FILTER_TYPES.CATEGORY]: {
      label: 'Project Type',
      options: [
        { value: 'Residential', label: 'Residential' },
        { value: 'Commercial', label: 'Commercial' }
      ]
    },
    [FILTER_TYPES.PRIORITY]: {
      options: [
        { value: 'high', label: 'High Priority', color: 'red' },
        { value: 'medium', label: 'Medium Priority', color: 'yellow' },
        { value: 'low', label: 'Low Priority', color: 'green' }
      ]
    }
  },
  // Lost Leads Page - Loss analysis focused filters
  lostleads: {
    [FILTER_TYPES.SEARCH]: {
      placeholder: 'Search by client name, phone, loss reason...',
      fields: ['name', 'phone', 'email', 'city', 'projectType', 'lostReason']
    },
    [FILTER_TYPES.SORT_DATE]: true,
    [FILTER_TYPES.STATUS]: {
      options: [
        { value: 'budget', label: 'Budget Issue', color: 'red' },
        { value: 'timing', label: 'Timing Issue', color: 'orange' },
        { value: 'competition', label: 'Lost to Competition', color: 'purple' },
        { value: 'requirements', label: 'Requirements Mismatch', color: 'yellow' },
        { value: 'communication', label: 'Communication Issue', color: 'gray' },
        { value: 'other', label: 'Other Reason', color: 'blue' }
      ]
    },
    [FILTER_TYPES.CATEGORY]: {
      label: 'Project Type',
      options: [
        { value: 'Residential', label: 'Residential' },
        { value: 'Commercial', label: 'Commercial' }
      ]
    },
    [FILTER_TYPES.DATE_RANGE]: {
      label: 'Lost Date',
      field: 'lostAt'
    }
  }
};

// Proposal Module Filters - Context-aware configurations
export const PROPOSAL_FILTERS = {
  // General Proposals Page - Comprehensive proposal management
  proposals: {
    [FILTER_TYPES.SEARCH]: {
      placeholder: 'Search by client name, proposal ID...',
      fields: ['clientId.name', 'leadId.name', '_id']
    },
    [FILTER_TYPES.SORT_ALPHABET]: true,
    [FILTER_TYPES.SORT_DATE]: true,
    [FILTER_TYPES.STATUS]: {
      options: [
        { value: 'draft', label: 'Draft', color: 'gray' },
        { value: 'pending_approval', label: 'Pending Approval', color: 'yellow' },
        { value: 'approved', label: 'Approved', color: 'green' },
        { value: 'rejected', label: 'Rejected', color: 'red' },
        { value: 'sent', label: 'Sent', color: 'blue' },
        { value: 'esign_received', label: 'eSign Received', color: 'purple' }
      ]
    },
    [FILTER_TYPES.CATEGORY]: {
      label: 'Proposal Type',
      options: [
        { value: 'residential', label: 'Residential' },
        { value: 'commercial', label: 'Commercial' }
      ]
    },
    [FILTER_TYPES.DATE_RANGE]: {
      label: 'Created Date',
      field: 'createdAt'
    },
    [FILTER_TYPES.AMOUNT]: {
      label: 'Proposal Amount',
      field: 'finalAmount'
    }
  },
  // Manager Approval Dashboard - Approval focused filters
  approval: {
    [FILTER_TYPES.SEARCH]: {
      placeholder: 'Search by client name, proposal title...',
      fields: ['clientId.name', 'leadId.name', 'title']
    },
    [FILTER_TYPES.SORT_DATE]: true,
    [FILTER_TYPES.STATUS]: {
      options: [
        { value: 'draft', label: 'Draft', color: 'gray' },
        { value: 'pending_approval', label: 'Pending Approval', color: 'yellow' },
        { value: 'manager_approved', label: 'Manager Approved', color: 'green' },
        { value: 'rejected', label: 'Rejected', color: 'red' },
        { value: 'sent', label: 'Sent', color: 'blue' }
      ]
    },
    [FILTER_TYPES.CATEGORY]: {
      label: 'Proposal Type',
      options: [
        { value: 'residential', label: 'Residential' },
        { value: 'commercial', label: 'Commercial' }
      ]
    },
    [FILTER_TYPES.DATE_RANGE]: {
      label: 'Proposal Date',
      field: 'createdAt'
    },
    [FILTER_TYPES.AMOUNT]: {
      label: 'Proposal Amount',
      field: 'finalAmount'
    }
  },
  // Sent Proposals Dashboard - eSign and payment focused filters
  sent: {
    [FILTER_TYPES.SEARCH]: {
      placeholder: 'Search by client name, proposal title...',
      fields: ['clientId.name', 'leadId.name', 'title']
    },
    [FILTER_TYPES.SORT_DATE]: true,
    [FILTER_TYPES.STATUS]: {
      options: [
        { value: 'sent', label: 'Sent', color: 'blue' },
        { value: 'esign_received', label: 'eSign Received', color: 'purple' },
        { value: 'payment_received', label: 'Payment Received', color: 'green' },
        { value: 'project_ready', label: 'Project Ready', color: 'orange' },
        { value: 'project_started', label: 'Project Started', color: 'teal' }
      ]
    },
    [FILTER_TYPES.CATEGORY]: {
      label: 'Proposal Type',
      options: [
        { value: 'residential', label: 'Residential' },
        { value: 'commercial', label: 'Commercial' }
      ]
    },
    [FILTER_TYPES.DATE_RANGE]: {
      label: 'Sent Date',
      field: 'sentAt'
    },
    [FILTER_TYPES.AMOUNT]: {
      label: 'Proposal Amount',
      field: 'finalAmount'
    }
  },
  // Approved Dashboard - Payment and project status focused filters
  approved: {
    [FILTER_TYPES.SEARCH]: {
      placeholder: 'Search by client name, proposal title...',
      fields: ['clientId.name', 'leadId.name', 'title']
    },
    [FILTER_TYPES.SORT_DATE]: true,
    [FILTER_TYPES.STATUS]: {
      options: [
        { value: 'manager_approved', label: 'Manager Approved', color: 'green' },
        { value: 'sent', label: 'Sent', color: 'blue' },
        { value: 'esign_received', label: 'eSign Received', color: 'purple' },
        { value: 'payment_received', label: 'Payment Received', color: 'emerald' },
        { value: 'project_ready', label: 'Project Ready', color: 'orange' },
        { value: 'project_started', label: 'Project Started', color: 'teal' }
      ]
    },
    [FILTER_TYPES.CATEGORY]: {
      label: 'Proposal Type',
      options: [
        { value: 'residential', label: 'Residential' },
        { value: 'commercial', label: 'Commercial' }
      ]
    },
    [FILTER_TYPES.DATE_RANGE]: {
      label: 'Approval Date',
      field: 'approvedAt'
    },
    [FILTER_TYPES.AMOUNT]: {
      label: 'Proposal Amount',
      field: 'finalAmount'
    }
  },
  // Proposal Clients Page - Client focused filters
  clients: {
    [FILTER_TYPES.SEARCH]: {
      placeholder: 'Search by client name, email, phone...',
      fields: ['name', 'email', 'phone', 'company']
    },
    [FILTER_TYPES.SORT_ALPHABET]: true,
    [FILTER_TYPES.SORT_DATE]: true,
    [FILTER_TYPES.CATEGORY]: {
      label: 'Client Type',
      options: [
        { value: 'individual', label: 'Individual' },
        { value: 'corporate', label: 'Corporate' }
      ]
    },
    [FILTER_TYPES.STATUS]: {
      options: [
        { value: 'active', label: 'Active', color: 'green' },
        { value: 'inactive', label: 'Inactive', color: 'gray' },
        { value: 'prospect', label: 'Prospect', color: 'blue' }
      ]
    },
    [FILTER_TYPES.DATE_RANGE]: {
      label: 'Client Since',
      field: 'createdAt'
    }
  },
  // Templates Page - Template focused filters
  templates: {
    [FILTER_TYPES.SEARCH]: {
      placeholder: 'Search by template name...',
      fields: ['name', 'description']
    },
    [FILTER_TYPES.SORT_ALPHABET]: true,
    [FILTER_TYPES.SORT_DATE]: true,
    [FILTER_TYPES.CATEGORY]: {
      label: 'Template Type',
      options: [
        { value: 'residential', label: 'Residential' },
        { value: 'commercial', label: 'Commercial' }
      ]
    },
    [FILTER_TYPES.STATUS]: {
      options: [
        { value: 'active', label: 'Active', color: 'green' },
        { value: 'draft', label: 'Draft', color: 'gray' },
        { value: 'archived', label: 'Archived', color: 'red' }
      ]
    },
    [FILTER_TYPES.DATE_RANGE]: {
      label: 'Created Date',
      field: 'createdAt'
    }
  }
};

// Dashboard Filters
export const DASHBOARD_FILTERS = {
  overview: {
    [FILTER_TYPES.DATE_RANGE]: {
      label: 'Date Range',
      field: 'createdAt'
    },
    [FILTER_TYPES.CATEGORY]: {
      label: 'Activity Type',
      options: [
        { value: 'meetings', label: 'Meetings' },
        { value: 'proposals', label: 'Proposals' },
        { value: 'conversions', label: 'Conversions' },
        { value: 'followups', label: 'Follow-ups' }
      ]
    }
  }
};

// Helper function to get filter config for a specific module and entity
export const getFilterConfig = (module, entity) => {
  const configs = {
    crm: CRM_FILTERS,
    proposal: PROPOSAL_FILTERS,
    dashboard: DASHBOARD_FILTERS
  };
  
  return configs[module]?.[entity] || {};
};

// Helper function to generate API query from filters
export const generateApiQuery = (filters) => {
  const query = {};
  
  // Handle search
  if (filters.search) {
    query.search = filters.search;
  }
  
  // Handle status
  if (filters.status && filters.status.length > 0) {
    query.status = filters.status.join(',');
  }
  
  // Handle category
  if (filters.category) {
    query.category = filters.category;
  }
  
  // Handle date range
  if (filters.dateRange) {
    if (filters.dateRange.start) {
      query.dateFrom = filters.dateRange.start;
    }
    if (filters.dateRange.end) {
      query.dateTo = filters.dateRange.end;
    }
  }
  
  // Handle sorting
  if (filters.sort) {
    const sortOption = Object.values(SORT_OPTIONS).find(opt => opt.value === filters.sort);
    if (sortOption) {
      query.sort = sortOption.field;
      query.order = sortOption.direction === 1 ? 'asc' : 'desc';
    }
  }
  
  // Handle priority
  if (filters.priority) {
    query.priority = filters.priority;
  }
  
  // Handle amount range
  if (filters.amountRange) {
    if (filters.amountRange.min) {
      query.amountMin = filters.amountRange.min;
    }
    if (filters.amountRange.max) {
      query.amountMax = filters.amountRange.max;
    }
  }
  
  return query;
};
