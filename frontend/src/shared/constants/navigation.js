import {
  LayoutDashboard,
  Users,
  UserCheck,
  Briefcase,
  CheckSquare,
  BarChart2,
  Settings,
  FileText,
  MessageCircle // <-- Added for the KIT main menu
} from 'lucide-react';

export const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard'
  },
  {
    id: 'crm',
    label: 'CRM',
    icon: Users,
    children: [
      { 
        id: 'crm-form', 
        label: 'Form', 
        path: '/crm/forms/enquiry' 
      },
      { 
        id: 'new-leads', 
        label: 'New Leads', 
        path: '/crm/new-leads' 
      },
      { 
        id: 'meetings', 
        label: 'Meetings', 
        path: '/crm/meetings' 
      },
      { 
        id: 'converted', 
        label: 'Converted', 
        path: '/crm/converted' 
      },
      { 
        id: 'lost', 
        label: 'Lost', 
        path: '/crm/lost-leads' 
      },
    ],
  },
  // --- NEW TOP-LEVEL KIT MODULE ---
  {
    id: 'kit',
    label: 'KIT',
    icon: MessageCircle, 
    children: [
      { 
        id: 'kit-follow-ups', 
        label: 'Follow Ups', 
        path: '/kit/follow-ups' 
      },
      { 
        id: 'kit-whatsapp', 
        label: 'WhatsApp Templates', 
        path: '/kit/whatsapp' 
      },
      { 
        id: 'kit-mail', 
        label: 'Mail Templates', 
        path: '/kit/mail' 
      },
      { 
        id: 'kit-settings', 
        label: 'Timeline Settings', 
        path: '/kit/settings' 
      },
    ]
  },
  // ---------------------------------
  {
    id: 'proposal-system',
    label: 'Proposal & Quotation System',
    icon: FileText,
    children: [
      { id: 'proposal-list', label: 'Proposal Dashboard', path: '/proposal' },
      { id: 'proposal-create', label: 'Create Proposal', path: '/proposal/create' },
      { id: 'proposal-clients', label: 'Client List', path: '/proposal/clients' },
      { id: 'proposal-templates', label: 'Quotation Template', path: '/proposal/templates' },
      { id: 'proposal-approval', label: 'Manager Approval', path: '/proposal/approval' },
      { id: 'proposal-sent', label: 'Sent & eSign Track', path: '/proposal/sent' },
      { id: 'proposal-approved', label: 'Approved', path: '/proposal/approved' },
    ]
  },
  {
    id: 'clients',
    label: 'Clients',
    icon: UserCheck,
    path: '/clients'
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: Briefcase,
    path: '/projects'
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: CheckSquare,
    path: '/tasks'
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: BarChart2,
    path: '/reports'
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    path: '/settings'
  },
];