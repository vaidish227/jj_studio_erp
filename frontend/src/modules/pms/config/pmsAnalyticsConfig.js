/**
 * PMS Analytics configuration — targeted scope (E1): only the Project Overview
 * and Release SLA tabs participate in the shared date-filter system. Designer
 * Utilisation, Vendor Performance, and Profitability remain all-time snapshots.
 */
export const PMS_ANALYTICS_CONFIG = {
  storageKey: 'pms_analytics_range',
  defaultRange: { preset: 'last_30_days' },
  errorMessage: 'Failed to load analytics.',
};
