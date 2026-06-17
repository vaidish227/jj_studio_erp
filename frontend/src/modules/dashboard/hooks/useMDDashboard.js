import useDashboardQuery from '../../../shared/dashboard-filter/hooks/useDashboardQuery';
import { mdDashboardService } from '../../../shared/services/mdDashboardService';
import { MD_DASHBOARD_CONFIG } from '../config/mdDashboardConfig';

/**
 * MD Dashboard data hook — thin wrapper over the shared useDashboardQuery.
 * Behavior (range-aware fetch, keep-data on refetch, 60s polling) is identical
 * to the previous bespoke implementation.
 *
 * @param {{preset?:string, from?:string, to?:string}} range
 */
const useMDDashboard = (range) =>
  useDashboardQuery(mdDashboardService.getMDOverview, range, {
    pollMs: MD_DASHBOARD_CONFIG.pollMs,
    errorMessage: MD_DASHBOARD_CONFIG.errorMessage,
  });

export default useMDDashboard;
