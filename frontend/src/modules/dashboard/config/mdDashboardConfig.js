/**
 * MD Dashboard configuration — the per-dashboard seam that keeps the shared
 * dashboard-filter foundation generic. Future dashboards (CRM, Main, PMS) get
 * their own equivalent config instead of duplicating logic.
 */
export const MD_DASHBOARD_CONFIG = {
  storageKey: 'md_dashboard_range',
  defaultRange: { preset: 'last_30_days' }, // reproduces the legacy period=month behavior
  pollMs: 60000,
  errorMessage: 'Failed to load MD dashboard.',
};

/**
 * MD/PMS-specific: map a preset onto the legacy period bucket (week|month) for
 * child components that still speak the old vocabulary — e.g. DesignerKRAScoreboard,
 * whose detail-page links use ?period=week|month|quarter|all. (Moved out of the
 * shared util because the legacy vocabulary differs per dashboard.)
 */
export const toLegacyPeriod = (preset) =>
  (preset === 'today' || preset === 'yesterday' || preset === 'last_7_days') ? 'week' : 'month';
