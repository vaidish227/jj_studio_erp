import {
  LayoutDashboard,
  Users,
  UserCheck,
  Briefcase,
  BarChart2,
  Settings,
  FileText,
  MessageCircle,
  FolderOpen,
  MessagesSquare,
} from 'lucide-react';

// Each item has an optional `permission` key.
// If present, the sidebar hides the item when the user lacks that permission.
// Children have their own explicit permissions — module.tab.tabkey for section
// visibility, or module.action for action-gated pages.
//
// IMPORTANT: child `id` values must match the last URL segment of their `path`
// because AppLayout derives activeItem from the last path segment.

export const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
    permission: 'dashboard.read',
  },
  {
    id: 'crm',
    label: 'CRM',
    icon: Users,
    permission: 'crm.read',
    children: [
      { id: 'new-leads',   label: 'New Leads',   path: '/crm/new-leads',     permission: 'crm.tab.leads' },
      { id: 'meetings',           label: 'Meetings',  path: '/crm/meetings',          permission: 'crm.tab.meetings' },
      { id: 'meetings-calendar',  label: 'Calendar',  path: '/crm/meetings/calendar', permission: 'crm.tab.meetings' },
      { id: 'converted',   label: 'Converted',   path: '/crm/converted',     permission: 'crm.tab.converted' },
      { id: 'lost',        label: 'Lost',        path: '/crm/lost-leads',     permission: 'crm.tab.lost' },
      { id: 'crm-clients', label: 'All Leads', path: '/crm/clients',       permission: 'crm.tab.clients' },
    ],
  },
  {
    id: 'kit',
    label: 'KIT',
    icon: MessageCircle,
    permission: 'kit.read',
    children: [
      { id: 'kit-follow-ups', label: 'Follow Ups',         path: '/kit/follow-ups' },
      { id: 'kit-whatsapp',   label: 'WhatsApp Templates', path: '/kit/whatsapp',   permission: 'kit.tab.templates' },
      { id: 'kit-mail',       label: 'Mail Templates',     path: '/kit/mail',       permission: 'kit.tab.templates' },
      { id: 'kit-settings',   label: 'Timeline Settings',  path: '/kit/settings',   permission: 'kit.manage' },
    ],
  },
  {
    id: 'proposal-system',
    label: 'Proposal & Quotation System',
    icon: FileText,
    permission: 'proposal.read',
    children: [
      { id: 'proposal-list',      label: 'Proposal Dashboard', path: '/proposal' },
      { id: 'proposal-create',    label: 'Create Proposal',    path: '/proposal/create',   permission: 'proposal.create' },
      { id: 'proposal-clients',   label: 'Client List',        path: '/proposal/clients' },
      { id: 'proposal-templates', label: 'Quotation Template', path: '/proposal/templates', permission: 'proposal.tab.templates' },
      { id: 'proposal-approval',  label: 'Manager Approval',   path: '/proposal/approval',  permission: 'proposal.tab.approval' },
      { id: 'proposal-sent',      label: 'Sent & eSign Track', path: '/proposal/sent' },
      { id: 'proposal-approved',  label: 'Approved',           path: '/proposal/approved' },
    ],
  },
  {
    id: 'clients',
    label: 'Clients',
    icon: UserCheck,
    path: '/clients',
    permission: 'clients.read',
  },
  {
    id: 'projects',
    label: 'Project Management',
    icon: Briefcase,
    permission: 'projects.read',
    children: [
      { id: 'projects',          label: 'All Projects',             path: '/projects' },
      { id: 'assign-task',       label: 'Assign Task',              path: '/pms/assign-task',       permission: 'projects.tab.assign' },
      { id: 'review-design',     label: 'Approval / Review Design', path: '/pms/review-design',     permission: 'projects.tab.review' },
      { id: 'whatsapp-groups',   label: 'WhatsApp Groups',          path: '/pms/whatsapp-groups',   permission: 'pms.whatsapp.manage' },
      { id: 'vendors',           label: 'Vendor Directory',         path: '/vendors',                permission: 'vendor.read' },
    ],
  },
  {
    id: 'design-drawing',
    label: 'Design and Drawing Management',
    icon: FolderOpen,
    permission: 'drawings.read',
    children: [
      { id: 'designer-dashboard', label: 'My Dashboard',    path: '/designer/dashboard', permission: 'designer.dashboard' },
      { id: 'tasks',              label: 'My Task',          path: '/tasks',              permission: 'tasks.submit' },
      { id: 'drawings',           label: 'Drawing Library', path: '/drawings' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: BarChart2,
    path: '/reports',
    permission: 'reports.read',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    permission: 'settings.read',
    children: [
      { id: 'users',             label: 'User Management',     path: '/settings/users',             permission: 'settings.tab.users' },
      { id: 'roles-permissions', label: 'Roles & Permissions', path: '/settings/roles-permissions', permission: 'settings.tab.roles' },
    ],
  },
];
