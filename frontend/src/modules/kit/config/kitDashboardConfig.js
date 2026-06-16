/**
 * KIT Analytics configuration — per-dashboard seam for the shared dashboard-filter
 * foundation. Defaults to Last 30 Days (analytics-natural); delivery/engagement
 * metrics honor the range while operational state counts stay all-time snapshots.
 * 60s polling — the heaviest dashboard; flip pollMs to 0 to disable.
 */
export const KIT_ANALYTICS_CONFIG = {
  storageKey: 'kit_analytics_range',
  defaultRange: { preset: 'last_30_days' },
  pollMs: 60000,
  errorMessage: 'Failed to load analytics.',
};
