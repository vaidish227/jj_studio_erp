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
} from 'lucide-react';

// Each item has an optional `permission` key.
// If present, the sidebar hides the item when the user lacks that permission.
// Children inherit the parent's permission unless they define their own.

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
      { id: 'crm-form',   label: 'Form',      path: '/crm/forms/enquiry', permission: 'crm.create' },
      { id: 'new-leads',  label: 'New Leads', path: '/crm/new-leads' },
      { id: 'meetings',   label: 'Meetings',  path: '/crm/meetings' },
      { id: 'converted',  label: 'Converted', path: '/crm/converted' },
      { id: 'lost',       label: 'Lost',      path: '/crm/lost-leads' },
    ],
  },
  {
    id: 'kit',
    label: 'KIT',
    icon: MessageCircle,
    permission: 'kit.read',
    children: [
      { id: 'kit-follow-ups', label: 'Follow Ups',        path: '/kit/follow-ups' },
      { id: 'kit-whatsapp',   label: 'WhatsApp Templates', path: '/kit/whatsapp' },
      { id: 'kit-mail',       label: 'Mail Templates',    path: '/kit/mail' },
      { id: 'kit-settings',   label: 'Timeline Settings', path: '/kit/settings' },
    ],
  },
  {
    id: 'proposal-system',
    label: 'Proposal & Quotation System',
    icon: FileText,
    permission: 'proposal.read',
    children: [
      { id: 'proposal-list',      label: 'Proposal Dashboard',  path: '/proposal' },
      { id: 'proposal-create',    label: 'Create Proposal',     path: '/proposal/create',   permission: 'proposal.create' },
      { id: 'proposal-clients',   label: 'Client List',         path: '/proposal/clients' },
      { id: 'proposal-templates', label: 'Quotation Template',  path: '/proposal/templates' },
      { id: 'proposal-approval',  label: 'Manager Approval',    path: '/proposal/approval', permission: 'proposal.approve' },
      { id: 'proposal-sent',      label: 'Sent & eSign Track',  path: '/proposal/sent' },
      { id: 'proposal-approved',  label: 'Approved',            path: '/proposal/approved' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    permission: 'settings.read',
    children: [
      {
        id: 'settings-users',
        label: 'User Management',
        path: '/settings/users',
        permission: 'users.manage',
      },
      {
        id: 'settings-roles',
        label: 'Roles & Permissions',
        path: '/settings/roles',
        permission: 'users.manage',
      },
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
    label: 'Projects',
    icon: Briefcase,
    path: '/projects',
    permission: 'projects.read',
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: CheckSquare,
    path: '/tasks',
    permission: 'tasks.read',
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: BarChart2,
    path: '/reports',
    permission: 'reports.read',
  },
  
];
