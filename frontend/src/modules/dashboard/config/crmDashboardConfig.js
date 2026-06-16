/**
 * CRM Dashboard configuration — per-dashboard seam for the shared dashboard-filter
 * foundation. Default is Last 90 Days to preserve the prior `range=3m` experience
 * (matches the backend's last_90_days default; the two are verified identical).
 */
export const CRM_DASHBOARD_CONFIG = {
  storageKey: 'crm_dashboard_range',
  defaultRange: { preset: 'last_90_days' },
  pollMs: 30000,
  errorMessage: 'Failed to load CRM dashboard.',
};
