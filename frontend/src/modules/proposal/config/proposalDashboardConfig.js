/**
 * Proposal Dashboard configuration — per-dashboard seam for the shared
 * dashboard-filter foundation. Defaults to All Time to preserve the dashboard's
 * historic "all proposals" view; KPIs are cohort counts by Proposal.createdAt.
 */
export const PROPOSAL_DASHBOARD_CONFIG = {
  storageKey: 'proposal_dashboard_range',
  defaultRange: { preset: 'all_time' },
  pollMs: 60000,
  errorMessage: 'Failed to load proposals.',
};
