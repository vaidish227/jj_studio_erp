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
  Crown,
  ListTodo,
  LayoutTemplate,
} from 'lucide-react';

// Each item has an optional `permission` key.
// If present, the sidebar hides the item when the user lacks that permission.
// Children have their own explicit permissions — module.tab.tabkey for section
// visibility, or module.action for action-gated pages.
//
// IMPORTANT: every `id` must be UNIQUE across the whole tree — AppLayout resolves
// the active row by matching the current URL to an item's `path`, then highlights
// the row(s) whose `id` equals that match. Duplicate ids highlight more than one row.

export const NAV_ITEMS = [
  {
    id: 'md-dashboard',
    label: 'MD Dashboard',
    icon: Crown,
    path: '/md/dashboard',
    permission: 'md.dashboard.read',
  },
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
      { id: 'crm-dashboard', label: 'CRM Dashboard', path: '/crm/dashboard',    permission: 'crm.read' },
      // { id: 'new-leads',   label: 'Create New Lead',   path: '/crm/new-leads',     permission: 'crm.tab.leads' },
      { id: 'new-leads',   label: 'Create New Lead',   path: '/crm/forms/enquiry',     permission: 'crm.tab.leads' },
      { id: 'meetings',           label: 'Meetings',  path: '/crm/meetings',          permission: 'crm.tab.meetings' },
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
      { id: 'kit-campaigns',  label: 'Campaigns',          path: '/kit/campaigns',  permission: 'kit.read' },
      { id: 'kit-automations',label: 'Automations',        path: '/kit/automations',permission: 'kit.manage' },
      { id: 'kit-thank-you',  label: 'Thank-You Messages',   path: '/kit/thank-you', permission: 'kit.manage' },
      { id: 'kit-kickoff',    label: 'Project Kickoff',     path: '/kit/kickoff',    permission: 'kit.manage' },
      { id: 'kit-analytics',  label: 'Analytics',          path: '/kit/analytics',  permission: 'kit.read' },
      // WhatsApp/Mail Templates moved to the consolidated Templates group below.
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
      { id: 'proposal-clients',   label: 'Draft Proposals',    path: '/proposal/clients' },
      // Quotation Template moved to the consolidated Templates group below.
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
    // Designers work from their own Design panel — the CRM client list is noise.
    excludeRoles: ['designer'],
  },
  {
    id: 'projects',
    label: 'Project Management',
    icon: Briefcase,
    permission: 'projects.read',
    children: [
      // Designers get their own My Dashboard + My Calendar under the Design group,
      // so hide the managerial PMS dashboard and the duplicate calendar for them.
      { id: 'pms-dashboard',     label: 'Dashboard',                path: '/pms/dashboard',         permission: 'projects.read', excludeRoles: ['designer'] },
      { id: 'projects',          icon: Briefcase,  label: 'Projects',                 path: '/projects' },
      { id: 'assign-task',       label: 'Assign Task',              path: '/pms/assign-task',       permission: 'projects.tab.assign' },
      { id: 'review-design',     label: 'Approval / Review Design', path: '/pms/review-design',     permission: 'projects.tab.review' },
      { id: 'calendar',          label: 'Calendar',                 path: '/pms/calendar',          permission: 'calendar.read', excludeRoles: ['designer'] },
      { id: 'documents',         icon: FolderOpen, label: 'Documents',                path: '/pms/documents',         permission: 'projects.read' },
      { id: 'whatsapp-groups',   label: 'WhatsApp Groups',          path: '/pms/whatsapp-groups',   permission: 'pms.whatsapp.manage' },
      { id: 'vendors',           label: 'Vendor Directory',         path: '/vendors',                permission: 'vendor.read' },
    ],
  },
  {
    id: 'design-drawing',
    label: 'Design and Drawing Management',
    icon: FolderOpen,
    // Gate on `designer.dashboard` (a designer-specific permission) so that
    // privileged roles like MD/Admin — who have `drawings.read` to load
    // project drawings — don't see this sidebar group.
    permission: 'designer.dashboard',
    children: [
      // Designer's own dashboard, surfaced back in this group. Tasks and Calendar
      // remain trimmed per product decision, but their routes (/tasks,
      // /pms/calendar) stay registered so deep links still work.
      // The icon is used when the sidebar is flattened (designer role) and
      // collapsed to the icon rail; grouped/expanded views render labels only.
      { id: 'designer-dashboard', icon: LayoutDashboard, label: 'Dashboard', path: '/designer/dashboard', permission: 'designer.dashboard' },
      { id: 'drawings',           icon: FileText,        label: 'Drawings',  path: '/drawings',           permission: 'drawings.read' },
    ],
  },
  {
    id: 'delegation',
    label: 'Delegation',
    icon: ListTodo,
    permission: 'delegation.read',
    children: [
      { id: 'delegation-dashboard',   label: 'Dashboard',          path: '/delegation',             permission: 'delegation.dashboard' },
      { id: 'delegation-create',      label: 'Create Delegation',  path: '/delegation/create',      permission: 'delegation.create' },
      { id: 'delegation-list',        label: 'Delegation List',    path: '/delegation/list',        permission: 'delegation.read' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: BarChart2,
    permission: 'reports.read',
    children: [
      { id: 'pms-analytics', label: 'PMS Analytics', path: '/pms/analytics', permission: 'reports.read' },
    ],
  },
  {
    // Consolidated home for every template type across the app. The destination
    // routes still live under their owning modules (/proposal, /settings, /kit) —
    // only the sidebar entries are gathered here. No group-level permission: each
    // child carries its own gate, and SidebarGroup auto-hides when none are visible.
    id: 'templates',
    label: 'Templates',
    icon: LayoutTemplate,
    children: [
      { id: 'proposal-templates',  label: 'Quotation Template',  path: '/proposal/templates',           permission: 'proposal.tab.templates' },
      { id: 'checklist-templates', label: 'Checklist Templates', path: '/settings/checklist-templates', permission: 'settings.checklists.manage' },
      { id: 'workflow-templates',  label: 'Master Templates',    path: '/settings/workflow-templates',  permission: 'settings.workflows.manage' },
      { id: 'form-templates',      label: 'Form Templates',      path: '/pms/form-templates',           permission: 'projects.read' },
      // KIT communication templates — only surfaced when the KIT feature flag is
      // on, since their /kit/* routes are omitted from the router otherwise.
      ...(import.meta.env.VITE_ENABLE_KIT === 'true'
        ? [
            { id: 'kit-whatsapp',       label: 'WhatsApp Templates', path: '/kit/whatsapp',       permission: 'kit.tab.templates' },
            { id: 'kit-email-designs',  label: 'Email Design',       path: '/kit/email-designs', permission: 'kit.manage' },
            { id: 'kit-mail',           label: 'Mail Templates',     path: '/kit/mail',           permission: 'kit.tab.templates' },
          ]
        : []),
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    permission: 'settings.read',
    children: [
      { id: 'users',             label: 'User Management',     path: '/settings/users',             permission: 'settings.tab.users' },
      { id: 'roles-permissions', label: 'Roles & Permissions', path: '/settings/roles-permissions', permission: 'settings.tab.roles' },
      { id: 'responsibilities',    label: 'Responsibilities',    path: '/settings/responsibilities',    roles: ['admin', 'md'] },
    ],
  },
]
  // Feature flag: hide the KIT section entirely when VITE_ENABLE_KIT !== 'true'
  // (e.g. client builds). Mirrors the VITE_ENABLE_AI gating on AI components.
  .filter((item) => item.id !== 'kit' || import.meta.env.VITE_ENABLE_KIT === 'true');

// ─── Breadcrumb resolution ───────────────────────────────────────────────────
// Flatten the nav tree into every path-bearing item tagged with its parent
// group's label (null for top-level items). Used by the Navbar to show
// "Group / Page" context on the left, mirroring AppLayout's active-row logic.
const flattenForBreadcrumb = (items, group = null) =>
  items.flatMap((it) => [
    ...(it.path ? [{ path: it.path, label: it.label, group }] : []),
    ...(it.children ? flattenForBreadcrumb(it.children, it.label) : []),
  ]);

const BREADCRUMB_ENTRIES = flattenForBreadcrumb(NAV_ITEMS);

// Turn a URL segment ("review-design") into a Title ("Review Design") for routes
// that aren't represented in the nav tree (detail pages, deep sub-routes).
const humanizeSegment = (seg) =>
  seg.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// A path segment that's an id, not a page name — numeric id, Mongo ObjectId, or
// uuid. Detail routes like /projects/<id> should keep the parent page's title.
const looksLikeId = (seg) =>
  /^\d+$/.test(seg) ||
  /^[0-9a-f]{8,}$/i.test(seg) ||
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg);

// Resolve { group, title } for a pathname: exact nav match wins; otherwise the
// longest nav path that is a parent prefix (so /projects/123 inherits its
// parent). Falls back to humanizing trailing URL segments when nothing matches.
export const resolveBreadcrumb = (pathname) => {
  const exact = BREADCRUMB_ENTRIES.find((e) => e.path === pathname);
  if (exact) return { group: exact.group, title: exact.label };

  const prefix = BREADCRUMB_ENTRIES
    .filter((e) => pathname.startsWith(`${e.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
  if (prefix) {
    const tail = pathname.slice(prefix.path.length + 1).split('/')[0];
    // Detail page under a known nav page: surface the trailing label, keeping the
    // nav page as the group. An id tail keeps the parent page as the title.
    return !tail || looksLikeId(tail)
      ? { group: prefix.group, title: prefix.label }
      : { group: prefix.label, title: humanizeSegment(tail) };
  }

  const segs = pathname.split('/').filter(Boolean);
  if (!segs.length) return { group: null, title: 'Dashboard' };
  return {
    group: segs.length > 1 ? humanizeSegment(segs[segs.length - 2]) : null,
    title: humanizeSegment(segs[segs.length - 1]),
  };
};
