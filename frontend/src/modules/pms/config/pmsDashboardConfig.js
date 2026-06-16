/**
 * PMS Dashboard configuration — per-dashboard seam for the shared dashboard-filter
 * foundation. Default Last 30 Days (≈ old "month"); 60s polling for this heavy,
 * operational 3-endpoint dashboard.
 */
export const PMS_DASHBOARD_CONFIG = {
  storageKey: 'pms_dashboard_range',
  defaultRange: { preset: 'last_30_days' },
  pollMs: 60000,
  errorMessage: 'Failed to load dashboard.',
};

/**
 * Map a preset → legacy period bucket (week|month|quarter|all) for child components
 * that still speak the old vocabulary — e.g. DesignerKRAScoreboard detail-page links
 * (`?period=…`) and the adjacent designer-detail / analytics / report endpoints.
 */
export const toLegacyPeriod = (preset) => {
  if (preset === 'today' || preset === 'yesterday' || preset === 'last_7_days') return 'week';
  if (preset === 'last_90_days') return 'quarter';
  return 'month'; // last_30_days, this_month, last_month, custom
};
