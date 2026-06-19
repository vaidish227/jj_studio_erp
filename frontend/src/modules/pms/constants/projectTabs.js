// ─── Project Detail Tab → Permission map ─────────────────────────────────────
//
// Controls which tabs are visible inside a project's detail page
// (see ProjectDetailPage). A tab is shown when the user holds ANY of the
// permissions listed for it (wildcard '*' always passes — handled by
// `hasAnyPermission`).
//
// Each entry pairs the dedicated `pms.tab.*` flag (grantable from the
// "Project Detail Tabs" card in Roles & Permissions) with the underlying
// feature permission the tab's own data already requires. Listing both means:
//   • Backward-compatible: any role that already holds the feature permission
//     (e.g. `materials.read`) keeps seeing the tab — no migration, no re-grant.
//   • Additive control: granting the `pms.tab.*` flag can surface a tab for a
//     role that lacks the feature permission.
// To HIDE a feature tab from a role, revoke its feature permission (which also
// blocks the tab's API calls — keeping UI and backend consistent).
//
// Core project views (overview, team, handover, gates, activity) include
// `projects.read` so they stay visible to anyone who can open the project.
//
// Keys are the leaf tab ids used by ProjectDetailPage's TABS_LEGACY / TABS_V2.
export const PROJECT_TAB_PERMISSIONS = {
  overview:          ['pms.tab.overview', 'projects.read'],
  documents:         ['pms.tab.documents', 'documents.read', 'projects.read'],
  planner:           ['pms.tab.planner', 'planner.read'],
  gantt:             ['pms.tab.gantt', 'planner.read', 'tasks.read'],
  tasks:             ['pms.tab.tasks', 'tasks.read'],
  drawings:          ['pms.tab.drawings', 'drawings.read'],
  dlr:               ['pms.tab.dlr', 'drawings.read'],
  release_log:       ['pms.tab.release_log', 'drawings.release', 'drawings.read'],
  milestones:        ['pms.tab.milestones', 'milestones.read'],
  logs:              ['pms.tab.site_logs', 'site_logs.read'],
  site_visits:       ['pms.tab.site_visits', 'site_visits.read'],
  materials:         ['pms.tab.materials', 'materials.read'],
  vendor_engagement: ['pms.tab.vendors', 'vendor.read'],
  purchase_orders:   ['pms.tab.purchase_orders', 'purchase_orders.read'],
  team:              ['pms.tab.team', 'projects.read'],
  approvals:         ['pms.tab.approvals', 'approvals.read'],
  whatsapp:          ['pms.tab.whatsapp', 'pms.whatsapp.manage'],
  handover:          ['pms.tab.handover', 'projects.read'],
  activity:          ['pms.tab.activity', 'activity.read', 'projects.read'],
  gates:             ['pms.tab.gates', 'projects.read'],
  material_finalization: ['pms.tab.material_finalization', 'material_finalization.read'],
  snag_list:             ['pms.tab.snag_list', 'snag_list.read'],
  final_handover:        ['pms.tab.final_handover', 'final_handover.read'],
  contractor:            ['pms.tab.contractor', 'contractor.read'],
};

/**
 * Whether the given project-detail tab is visible to the current user.
 * @param {string} tabId  leaf tab id (e.g. 'materials')
 * @param {(perms: string[]) => boolean} hasAnyPermission  from useAuth()
 * @returns {boolean} true when unmapped (fail-open for unknown ids) or permitted
 */
export const canViewProjectTab = (tabId, hasAnyPermission) => {
  const perms = PROJECT_TAB_PERMISSIONS[tabId];
  if (!perms || perms.length === 0) return true;
  return hasAnyPermission(perms);
};
