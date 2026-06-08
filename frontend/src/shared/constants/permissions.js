// ─── Permission string constants ───────────────────────────────────────────────
// Level 1 — Module:  module.action  (read/create/update/delete/approve…)
// Level 2 — Tab:     module.tab.tabkey  (controls sub-section / nav-child visibility)
// Use these constants everywhere instead of raw strings to prevent typos.

export const PERMISSIONS = {
  // Dashboard
  DASHBOARD_READ: 'dashboard.read',

  // CRM
  CRM_READ:   'crm.read',
  CRM_CREATE: 'crm.create',
  CRM_UPDATE: 'crm.update',
  CRM_DELETE: 'crm.delete',
  // CRM tabs
  CRM_TAB_CLIENTS:   'crm.tab.clients',
  CRM_TAB_LEADS:     'crm.tab.leads',
  CRM_TAB_MEETINGS:  'crm.tab.meetings',
  CRM_TAB_CONVERTED: 'crm.tab.converted',
  CRM_TAB_LOST:      'crm.tab.lost',

  // KIT (Keep In Touch)
  KIT_READ:   'kit.read',
  KIT_CREATE: 'kit.create',
  KIT_UPDATE: 'kit.update',
  KIT_DELETE: 'kit.delete',
  KIT_MANAGE: 'kit.manage',
  // KIT tabs
  KIT_TAB_TEMPLATES: 'kit.tab.templates',

  // Proposal & Quotation
  PROPOSAL_READ:    'proposal.read',
  PROPOSAL_CREATE:  'proposal.create',
  PROPOSAL_UPDATE:  'proposal.update',
  PROPOSAL_DELETE:  'proposal.delete',
  PROPOSAL_APPROVE: 'proposal.approve',
  // Proposal tabs
  PROPOSAL_TAB_TEMPLATES: 'proposal.tab.templates',
  PROPOSAL_TAB_APPROVAL:  'proposal.tab.approval',

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
  // Per-project plan customization at initiation time (MD/admin)
  PROJECTS_CUSTOMIZE_PLAN: 'projects.customize_plan',
  // Project management nav tabs
  PROJECTS_TAB_ASSIGN: 'projects.tab.assign',
  PROJECTS_TAB_REVIEW: 'projects.tab.review',

  // Tasks
  TASKS_READ:          'tasks.read',
  TASKS_CREATE:        'tasks.create',
  TASKS_UPDATE:        'tasks.update',
  TASKS_DELETE:        'tasks.delete',
  TASKS_SUBMIT:        'tasks.submit',
  TASKS_APPROVE:       'tasks.approve',
  TASKS_REASSIGN:      'tasks.reassign',
  // Phase 1 — Workflow Engine
  TASKS_OVERRIDE_GATE: 'tasks.override_gate',

  // PMS project-detail tabs
  PMS_TAB_TASKS:    'pms.tab.tasks',
  PMS_TAB_DRAWINGS: 'pms.tab.drawings',
  PMS_TAB_TEAM:     'pms.tab.team',

  // Design & Drawing Management
  DRAWINGS_READ:      'drawings.read',
  DRAWINGS_UPLOAD:    'drawings.upload',
  DRAWINGS_APPROVE:   'drawings.approve',
  DRAWINGS_RELEASE:   'drawings.release',
  DESIGN_COMMENT:     'design.comment',
  DESIGNER_DASHBOARD: 'designer.dashboard',

  // Approvals (client-facing approval requests)
  APPROVALS_READ:    'approvals.read',
  APPROVALS_CREATE:  'approvals.create',
  APPROVALS_RESPOND: 'approvals.respond',

  // Site Logs
  SITE_LOGS_READ:   'site_logs.read',
  SITE_LOGS_CREATE: 'site_logs.create',

  // Site Visits
  SITE_VISITS_READ:   'site_visits.read',
  SITE_VISITS_CREATE: 'site_visits.create',
  SITE_VISITS_UPDATE: 'site_visits.update',

  // Materials
  MATERIALS_READ:   'materials.read',
  MATERIALS_CREATE: 'materials.create',
  MATERIALS_UPDATE: 'materials.update',
  MATERIALS_DELETE: 'materials.delete',

  // Purchase Orders
  PURCHASE_ORDERS_READ:   'purchase_orders.read',
  PURCHASE_ORDERS_CREATE: 'purchase_orders.create',
  PURCHASE_ORDERS_UPDATE: 'purchase_orders.update',

  // Milestones
  MILESTONES_READ:   'milestones.read',
  MILESTONES_CREATE: 'milestones.create',
  MILESTONES_UPDATE: 'milestones.update',
  MILESTONES_DELETE: 'milestones.delete',

  // Activity & Calendar
  ACTIVITY_READ: 'activity.read',
  CALENDAR_READ: 'calendar.read',

  // Communication — Mail
  MAIL_READ:   'mail.read',
  MAIL_SEND:   'mail.send',
  MAIL_MANAGE: 'mail.manage',

  // Communication — WhatsApp
  WHATSAPP_READ:   'whatsapp.read',
  WHATSAPP_SEND:   'whatsapp.send',
  WHATSAPP_MANAGE: 'whatsapp.manage',

  // Communication — Settings
  COMMUNICATION_SETTINGS_MANAGE: 'communication.settings.manage',
  PMS_WHATSAPP_MANAGE:           'pms.whatsapp.manage',

  // Vendor portal
  VENDOR_READ:   'vendor.read',
  VENDOR_CREATE: 'vendor.create',
  VENDOR_UPDATE: 'vendor.update',

  // Client portal
  CLIENT_PORTAL_READ: 'client_portal.read',

  // Reports
  REPORTS_READ:   'reports.read',
  REPORTS_EXPORT: 'reports.export',

  // Finance
  FINANCE_READ:   'finance.read',
  FINANCE_CREATE: 'finance.create',
  FINANCE_UPDATE: 'finance.update',

  // Settings & Users
  SETTINGS_READ:   'settings.read',
  SETTINGS_MANAGE: 'settings.manage',
  USERS_READ:      'users.read',
  USERS_CREATE:    'users.create',
  USERS_UPDATE:    'users.update',
  USERS_DELETE:    'users.delete',
  USERS_MANAGE:    'users.manage',
  // Settings tabs
  SETTINGS_TAB_USERS:      'settings.tab.users',
  SETTINGS_TAB_ROLES:      'settings.tab.roles',
  // Phase 1 — Workflow / Checklist template administration (UI lands in Phase 3)
  SETTINGS_CHECKLISTS_MANAGE: 'settings.checklists.manage',
  SETTINGS_WORKFLOWS_MANAGE:  'settings.workflows.manage',

  // Phase 1 — Principal Designer review pathway
  PD_REVIEW_RESPOND: 'pd.review.respond',
};

// ─── Module groupings for Roles & Permissions UI ──────────────────────────────
// Each module has:
//   key:         module identifier
//   label:       display name
//   description: one-liner shown in the permission UI
//   group:       section heading in the UI
//   actions:     action-level permissions available for this module
//   tabs:        (optional) sub-section tab permissions  [{key, label, permission}]
export const PERMISSION_MODULES = [
  {
    key:         'dashboard',
    label:       'Dashboard',
    description: 'Main overview with KPIs and recent activity',
    group:       'Core',
    actions:     ['read'],
  },
  {
    key:         'crm',
    label:       'CRM',
    description: 'Client relationship management — leads, meetings, pipeline',
    group:       'Sales',
    actions:     ['read', 'create', 'update', 'delete'],
    tabs: [
      { key: 'clients',   label: 'All Clients', permission: 'crm.tab.clients' },
      { key: 'leads',     label: 'New Leads',   permission: 'crm.tab.leads' },
      { key: 'meetings',  label: 'Meetings',    permission: 'crm.tab.meetings' },
      { key: 'converted', label: 'Converted',   permission: 'crm.tab.converted' },
      { key: 'lost',      label: 'Lost Leads',  permission: 'crm.tab.lost' },
    ],
  },
  {
    key:         'kit',
    label:       'KIT (Keep In Touch)',
    description: 'Communication automation — follow-ups, templates, campaigns, and workflows',
    group:       'Sales',
    actions:     ['read', 'create', 'update', 'delete', 'manage'],
    tabs: [
      { key: 'templates', label: 'Templates (WA + Mail)', permission: 'kit.tab.templates' },
    ],
  },
  {
    key:         'proposal',
    label:       'Proposal & Quotation',
    description: 'Create, send, and approve client proposals and quotations',
    group:       'Sales',
    actions:     ['read', 'create', 'update', 'delete', 'approve'],
    tabs: [
      { key: 'templates', label: 'Quotation Templates', permission: 'proposal.tab.templates' },
      { key: 'approval',  label: 'Manager Approval',   permission: 'proposal.tab.approval' },
    ],
  },
  {
    key:         'clients',
    label:       'Clients',
    description: 'Converted client profiles and contact management',
    group:       'Sales',
    actions:     ['read', 'create', 'update', 'delete'],
  },
  {
    key:         'projects',
    label:       'Projects (PMS)',
    description: 'Project lifecycle — creation, team, milestones, and deliverables',
    group:       'Project Management',
    actions:     ['read', 'create', 'update', 'delete'],
    tabs: [
      { key: 'assign', label: 'Assign Task Page',    permission: 'projects.tab.assign' },
      { key: 'review', label: 'Review / Approvals',  permission: 'projects.tab.review' },
    ],
  },
  {
    key:         'tasks',
    label:       'Tasks',
    description: 'Design and project tasks — create, assign, submit, and approve',
    group:       'Project Management',
    actions:     ['read', 'create', 'update', 'delete', 'submit', 'approve', 'reassign'],
  },
  {
    key:         'pms',
    label:       'Project Detail Tabs',
    description: 'Controls which tabs are visible inside a project\'s detail page',
    group:       'Project Management',
    actions:     [],
    tabs: [
      { key: 'tasks',    label: 'Tasks Tab',    permission: 'pms.tab.tasks' },
      { key: 'drawings', label: 'Drawings Tab', permission: 'pms.tab.drawings' },
      { key: 'team',     label: 'Team Tab',     permission: 'pms.tab.team' },
    ],
  },
  {
    key:         'drawings',
    label:       'Design & Drawing Management',
    description: 'Upload, review, approve, and release design drawings',
    group:       'Design',
    actions:     ['read', 'upload', 'approve', 'release'],
  },
  {
    key:         'design',
    label:       'Design Collaboration',
    description: 'Comment on and request revisions for design submissions',
    group:       'Design',
    actions:     ['comment'],
  },
  {
    key:         'designer',
    label:       'Designer Dashboard',
    description: 'Personal designer dashboard showing assigned tasks and submissions',
    group:       'Design',
    actions:     ['dashboard'],
  },
  {
    key:         'approvals',
    label:       'Client Approvals',
    description: 'Send approval requests to clients and track responses',
    group:       'Design',
    actions:     ['read', 'create', 'respond'],
  },
  {
    key:         'site_logs',
    label:       'Site Logs',
    description: 'On-site work diary and daily progress records',
    group:       'Site & Operations',
    actions:     ['read', 'create'],
  },
  {
    key:         'site_visits',
    label:       'Site Visits',
    description: 'Schedule and log site inspection visits',
    group:       'Site & Operations',
    actions:     ['read', 'create', 'update'],
  },
  {
    key:         'materials',
    label:       'Materials',
    description: 'Material specifications, procurement tracking, and inventory',
    group:       'Site & Operations',
    actions:     ['read', 'create', 'update', 'delete'],
  },
  {
    key:         'purchase_orders',
    label:       'Purchase Orders',
    description: 'Raise and track purchase orders to vendors',
    group:       'Site & Operations',
    actions:     ['read', 'create', 'update'],
  },
  {
    key:         'milestones',
    label:       'Milestones',
    description: 'Project milestones, deadlines, and completion gates',
    group:       'Site & Operations',
    actions:     ['read', 'create', 'update', 'delete'],
  },
  {
    key:         'activity',
    label:       'Activity Log',
    description: 'Audit trail of all project and system actions',
    group:       'Site & Operations',
    actions:     ['read'],
  },
  {
    key:         'calendar',
    label:       'Calendar',
    description: 'Team calendar for deadlines, site visits, and meetings',
    group:       'Site & Operations',
    actions:     ['read'],
  },
  {
    key:         'mail',
    label:       'Mail',
    description: 'Send and manage emails to clients and team members',
    group:       'Communication',
    actions:     ['read', 'send', 'manage'],
  },
  {
    key:         'whatsapp',
    label:       'WhatsApp',
    description: 'Send WhatsApp messages via integrated gateway',
    group:       'Communication',
    actions:     ['read', 'send', 'manage'],
  },
  {
    key:         'vendor',
    label:       'Vendor Directory',
    description: 'Manage vendor profiles and contact information',
    group:       'External',
    actions:     ['read', 'create', 'update'],
  },
  {
    key:         'client_portal',
    label:       'Client Portal',
    description: 'External client-facing portal for project status and approvals',
    group:       'External',
    actions:     ['read'],
  },
  {
    key:         'reports',
    label:       'Reports',
    description: 'Business intelligence reports and data exports',
    group:       'Finance & Reports',
    actions:     ['read', 'export'],
  },
  {
    key:         'finance',
    label:       'Finance',
    description: 'Payments, invoices, and financial summaries',
    group:       'Finance & Reports',
    actions:     ['read', 'create', 'update'],
  },
  {
    key:         'settings',
    label:       'Settings',
    description: 'System configuration, integrations, and company preferences',
    group:       'Administration',
    actions:     ['read', 'manage'],
    tabs: [
      { key: 'users', label: 'User Management',     permission: 'settings.tab.users' },
      { key: 'roles', label: 'Roles & Permissions', permission: 'settings.tab.roles' },
    ],
  },
  {
    key:         'users',
    label:       'User Management',
    description: 'Create and manage user accounts, roles, and custom permissions',
    group:       'Administration',
    actions:     ['read', 'create', 'update', 'delete', 'manage'],
  },
];

// ─── Feature areas — top-level cards in Roles & Permissions UI ────────────────
// A feature area is what the user thinks of as "one thing" in the sidebar (CRM,
// Proposal, Project Management, …). Each area bundles one or more permission
// modules so the role editor shows ONE clean card per area instead of dozens
// of small modules.
//
// To add a new module to an existing area: append its key to that area's
// `modules` array. To add a new top-level area: append a new entry below.
//
// `color` drives the accent on the card / detail panel header.
export const FEATURE_AREAS = [
  {
    key:         'dashboard',
    label:       'Dashboard',
    description: 'Main overview with KPIs and recent activity',
    icon:        'dashboard',
    color:       '#6B7280',
    modules:     ['dashboard'],
  },
  {
    key:         'crm',
    label:       'CRM',
    description: 'Client relationships, leads, meetings, and conversion pipeline',
    icon:        'crm',
    color:       '#D4B76C',
    modules:     ['crm'],
  },
  {
    key:         'proposal',
    label:       'Proposal & Quotation',
    description: 'Create, send, and approve client proposals and quotations',
    icon:        'proposal',
    color:       '#D4B76C',
    modules:     ['proposal'],
  },
  {
    key:         'clients',
    label:       'Clients',
    description: 'Converted client profiles and contact management',
    icon:        'clients',
    color:       '#D4B76C',
    modules:     ['clients'],
  },
  {
    key:         'kit',
    label:       'KIT (Keep In Touch)',
    description: 'Scheduled follow-ups and templated communications',
    icon:        'kit',
    color:       '#D4B76C',
    modules:     ['kit'],
  },
  {
    key:         'project_management',
    label:       'Project Management',
    description: 'Projects, tasks, milestones, and project detail tabs',
    icon:        'projects',
    color:       '#4A8F7C',
    modules:     ['projects', 'tasks', 'pms', 'milestones'],
  },
  {
    key:         'design',
    label:       'Design & Drawings',
    description: 'Drawing uploads, reviews, collaboration, and client approvals',
    icon:        'drawings',
    color:       '#9B59B6',
    modules:     ['drawings', 'design', 'designer', 'approvals'],
  },
  {
    key:         'site_operations',
    label:       'Site Operations',
    description: 'Site logs, visits, materials, and purchase orders',
    icon:        'site_logs',
    color:       '#E67E22',
    modules:     ['site_logs', 'site_visits', 'materials', 'purchase_orders'],
  },
  {
    key:         'activity_calendar',
    label:       'Activity & Calendar',
    description: 'Audit log and team calendar',
    icon:        'calendar',
    color:       '#E67E22',
    modules:     ['activity', 'calendar'],
  },
  {
    key:         'communication',
    label:       'Communication',
    description: 'Mail and WhatsApp messaging',
    icon:        'mail',
    color:       '#3A6EA5',
    modules:     ['mail', 'whatsapp'],
  },
  {
    key:         'vendor',
    label:       'Vendor Directory',
    description: 'Manage vendor profiles and contacts',
    icon:        'vendor',
    color:       '#7F8C8D',
    modules:     ['vendor'],
  },
  {
    key:         'client_portal',
    label:       'Client Portal',
    description: 'External client portal access',
    icon:        'client_portal',
    color:       '#7F8C8D',
    modules:     ['client_portal'],
  },
  {
    key:         'reports',
    label:       'Reports',
    description: 'Business intelligence reports and exports',
    icon:        'reports',
    color:       '#27AE60',
    modules:     ['reports'],
  },
  {
    key:         'finance',
    label:       'Finance',
    description: 'Payments, invoices, and financial summaries',
    icon:        'finance',
    color:       '#27AE60',
    modules:     ['finance'],
  },
  {
    key:         'settings',
    label:       'Settings',
    description: 'System configuration, users, and roles',
    icon:        'settings',
    color:       '#D93025',
    modules:     ['settings', 'users'],
  },
];

// ─── All roles in display order ────────────────────────────────────────────────
export const ROLE_OPTIONS = [
  { value: 'admin',      label: 'Administrator',     color: '#D93025' },
  { value: 'md',         label: 'Managing Director',  color: '#3A6EA5' },
  { value: 'manager',    label: 'Manager',            color: '#4A8F7C' },
  { value: 'sales',      label: 'Sales Executive',    color: '#D4B76C' },
  { value: 'accounts',   label: 'Accounts',           color: '#27AE60' },
  { value: 'designer',   label: 'Designer',           color: '#9B59B6' },
  { value: 'supervisor', label: 'Supervisor',         color: '#E67E22' },
  { value: 'vendor',     label: 'Vendor',             color: '#7F8C8D' },
  { value: 'client',     label: 'Client',             color: '#2980B9' },
];
