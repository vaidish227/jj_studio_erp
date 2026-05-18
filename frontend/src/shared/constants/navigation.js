import {
  LayoutDashboard,
  Users,
  UserCheck,
  Briefcase,
  CheckSquare,
  BarChart2,
  Settings,
  FileText,
  MessageCircle,
  FolderOpen,
  Store,
  Calendar,
  ClipboardCheck,
} from 'lucide-react';

// Each item has an optional `permission` key.
// If present, the sidebar hides the item when the user lacks that permission.
// Children inherit the parent's permission unless they define their own.
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
      { id: 'crm-form',    label: 'Form',        path: '/crm/forms/enquiry', permission: 'crm.create' },
      { id: 'crm-clients', label: 'All Clients', path: '/crm/clients' },
      { id: 'new-leads',   label: 'New Leads',   path: '/crm/new-leads' },
      { id: 'meetings',    label: 'Meetings',     path: '/crm/meetings' },
      { id: 'converted',   label: 'Converted',    path: '/crm/converted' },
      { id: 'lost',        label: 'Lost',         path: '/crm/lost-leads' },
    ],
  },
  {
    id: 'kit',
    label: 'KIT',
    icon: MessageCircle,
    permission: 'kit.read',
    children: [
      { id: 'kit-follow-ups', label: 'Follow Ups',         path: '/kit/follow-ups' },
      { id: 'kit-whatsapp',   label: 'WhatsApp Templates', path: '/kit/whatsapp' },
      { id: 'kit-mail',       label: 'Mail Templates',     path: '/kit/mail' },
      { id: 'kit-settings',   label: 'Timeline Settings',  path: '/kit/settings' },
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
      { id: 'proposal-templates', label: 'Quotation Template', path: '/proposal/templates' },
      { id: 'proposal-approval',  label: 'Manager Approval',   path: '/proposal/approval', permission: 'proposal.approve' },
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
      { id: 'projects-all',    label: 'All Projects',      path: '/projects' },
      { id: 'projects-create', label: 'New Project',       path: '/projects/create', permission: 'projects.create' },
      { id: 'tasks',           label: 'My Tasks',          path: '/tasks' },
      { id: 'pms-calendar',    label: 'Calendar',          path: '/pms/calendar',    permission: 'calendar.read' },
      { id: 'pms-approvals',   label: 'Approvals',         path: '/pms/approvals',   permission: 'approvals.read' },
      { id: 'vendors',         label: 'Vendor Directory',  path: '/vendors',         permission: 'vendor.read' },
    ],
  },
  {
    id: 'design-drawing',
    label: 'Design & Drawing (DLR)',
    icon: FolderOpen,
    permission: 'drawings.read',
    children: [
      { id: 'drawings',          label: 'Drawing Library',   path: '/drawings' },
      { id: 'pending-approvals', label: 'Pending Approvals', path: '/drawings/pending-approvals', permission: 'drawings.approve' },
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
      { id: 'users',             label: 'User Management',     path: '/settings/users',             permission: 'users.manage' },
      { id: 'roles-permissions', label: 'Roles & Permissions', path: '/settings/roles-permissions', permission: 'users.manage' },
    ],
  },
];
