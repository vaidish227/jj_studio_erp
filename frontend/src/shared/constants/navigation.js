import {
  LayoutDashboard,
  Users,
  UserCheck,
  Briefcase,
  CheckSquare,
  BarChart2,
  Settings,
  FileText
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
        id: 'crm-forms',
        label: 'Forms',
        children: [
          { id: 'enquiry-form', label: 'Enquiry Form', path: '/crm/forms/enquiry' },
        ]
      },
      {
        id: 'leads-pipeline',
        label: 'Leads Pipeline',
        children: [
          { id: 'new-leads', label: 'New Leads', path: '/crm/new-leads' },
          { id: 'meetings', label: 'Meetings', path: '/crm/meetings' },
          { id: 'follow-ups', label: 'Follow-ups', path: '/crm/follow-ups' },
          { id: 'kit', label: 'Keep In Touch (KIT)', path: '/crm/qualified' },
          { id: 'proposal', label: 'Proposals', path: '/crm/proposal' },
        ]
      },
      {
        id: 'crm-status',
        label: 'Lead Status',
        children: [
          { id: 'converted', label: 'Converted', path: '/crm/converted' },
          { id: 'lost-leads', label: 'Lost Leads', path: '/crm/lost-leads' },
        ]
      },
    ],
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
