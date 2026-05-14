// ─── Permission string constants ───────────────────────────────────────────────
// Format: MODULE.ACTION
// Use these constants everywhere instead of raw strings to prevent typos.

export const PERMISSIONS = {
  // Dashboard
  DASHBOARD_READ: 'dashboard.read',

  // CRM
  CRM_READ:   'crm.read',
  CRM_CREATE: 'crm.create',
  CRM_UPDATE: 'crm.update',
  CRM_DELETE: 'crm.delete',

  // KIT (Keep In Touch)
  KIT_READ:   'kit.read',
  KIT_CREATE: 'kit.create',
  KIT_UPDATE: 'kit.update',
  KIT_DELETE: 'kit.delete',

  // Proposal & Quotation
  PROPOSAL_READ:    'proposal.read',
  PROPOSAL_CREATE:  'proposal.create',
  PROPOSAL_UPDATE:  'proposal.update',
  PROPOSAL_DELETE:  'proposal.delete',
  PROPOSAL_APPROVE: 'proposal.approve',

  // Clients
  CLIENTS_READ:   'clients.read',
  CLIENTS_CREATE: 'clients.create',
  CLIENTS_UPDATE: 'clients.update',
  CLIENTS_DELETE: 'clients.delete',

  // Projects (PMS)
  PROJECTS_READ:   'projects.read',
  PROJECTS_CREATE: 'projects.create',
  PROJECTS_UPDATE: 'projects.update',
  PROJECTS_DELETE: 'projects.delete',

  // Tasks
  TASKS_READ:   'tasks.read',
  TASKS_CREATE: 'tasks.create',
  TASKS_UPDATE: 'tasks.update',
  TASKS_DELETE: 'tasks.delete',

  // Reports
  REPORTS_READ:   'reports.read',
  REPORTS_EXPORT: 'reports.export',

  // Finance
  FINANCE_READ:   'finance.read',
  FINANCE_CREATE: 'finance.create',
  FINANCE_UPDATE: 'finance.update',

  // Settings
  SETTINGS_READ:   'settings.read',
  SETTINGS_MANAGE: 'settings.manage',

  // User management
  USERS_READ:   'users.read',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DELETE: 'users.delete',
  USERS_MANAGE: 'users.manage',

  // Vendor portal
  VENDOR_READ:   'vendor.read',
  VENDOR_UPDATE: 'vendor.update',

  // Client portal
  CLIENT_PORTAL_READ: 'client_portal.read',
};

// ─── Module groupings for UI display ──────────────────────────────────────────
export const PERMISSION_MODULES = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    actions: ['read'],
  },
  {
    key: 'crm',
    label: 'CRM',
    actions: ['read', 'create', 'update', 'delete'],
  },
  {
    key: 'kit',
    label: 'KIT (Keep In Touch)',
    actions: ['read', 'create', 'update', 'delete'],
  },
  {
    key: 'proposal',
    label: 'Proposal & Quotation',
    actions: ['read', 'create', 'update', 'delete', 'approve'],
  },
  {
    key: 'clients',
    label: 'Clients',
    actions: ['read', 'create', 'update', 'delete'],
  },
  {
    key: 'projects',
    label: 'Projects (PMS)',
    actions: ['read', 'create', 'update', 'delete'],
  },
  {
    key: 'tasks',
    label: 'Tasks',
    actions: ['read', 'create', 'update', 'delete'],
  },
  {
    key: 'reports',
    label: 'Reports',
    actions: ['read', 'export'],
  },
  {
    key: 'finance',
    label: 'Finance',
    actions: ['read', 'create', 'update'],
  },
  {
    key: 'settings',
    label: 'Settings',
    actions: ['read', 'manage'],
  },
  {
    key: 'users',
    label: 'User Management',
    actions: ['read', 'create', 'update', 'delete', 'manage'],
  },
  {
    key: 'vendor',
    label: 'Vendor Portal',
    actions: ['read', 'update'],
  },
  {
    key: 'client_portal',
    label: 'Client Portal',
    actions: ['read'],
  },
];

// ─── All roles in display order ────────────────────────────────────────────────
export const ROLE_OPTIONS = [
  { value: 'admin',      label: 'Administrator',    color: '#D93025' },
  { value: 'md',         label: 'Managing Director', color: '#3A6EA5' },
  { value: 'manager',    label: 'Manager',           color: '#4A8F7C' },
  { value: 'sales',      label: 'Sales Executive',   color: '#D4B76C' },
  { value: 'accounts',   label: 'Accounts',          color: '#27AE60' },
  { value: 'designer',   label: 'Designer',          color: '#9B59B6' },
  { value: 'supervisor', label: 'Supervisor',        color: '#E67E22' },
  { value: 'vendor',     label: 'Vendor',            color: '#7F8C8D' },
  { value: 'client',     label: 'Client',            color: '#2980B9' },
];
