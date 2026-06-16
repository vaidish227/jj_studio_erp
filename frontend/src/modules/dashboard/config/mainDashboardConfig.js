/**
 * Main (Sales) Dashboard configuration — per-dashboard seam for the shared
 * dashboard-filter foundation. Default is Last 90 Days to match the prior
 * `range=3m` window (verified identical on the backend), and persists under its
 * own key so it's independent of MD and CRM.
 */
export const MAIN_DASHBOARD_CONFIG = {
  storageKey: 'main_dashboard_range',
  defaultRange: { preset: 'last_90_days' },
  pollMs: 30000,
  errorMessage: 'Failed to load dashboard.',
};
