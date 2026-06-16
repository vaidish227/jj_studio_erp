import useDashboardQuery from '../../../shared/dashboard-filter/hooks/useDashboardQuery';
import { crmService } from '../../../shared/services/crmService';
import { CRM_DASHBOARD_CONFIG } from '../config/crmDashboardConfig';

// Unwrap the service envelope ({ message, data }) → data, matching the prior hook.
const fetchCRM = (range) => crmService.getCRMDashboard(range).then((res) => res?.data ?? null);

/**
 * CRM Dashboard data hook — thin wrapper over the shared useDashboardQuery.
 *
 * Accepts BOTH a legacy string ('3m'|'6m'|'1y') and a new range object
 * {preset,from,to}. A bare string is normalized to { preset: <token> } so the
 * Main (Sales) Dashboard — which still calls useCRMDashboard('3m') — flows
 * through unchanged (crmService maps legacy tokens back to ?range=…).
 *
 * Return shape ({ data, isLoading, error, refresh }) and 30s polling preserved.
 */
const useCRMDashboard = (range = '3m') => {
  const normalized = typeof range === 'string' ? { preset: range } : range;
  return useDashboardQuery(fetchCRM, normalized, {
    pollMs: CRM_DASHBOARD_CONFIG.pollMs,
    errorMessage: CRM_DASHBOARD_CONFIG.errorMessage,
  });
};

export default useCRMDashboard;
