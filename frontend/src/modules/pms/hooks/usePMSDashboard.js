import useDashboardQuery from '../../../shared/dashboard-filter/hooks/useDashboardQuery';
import { pmsService } from '../../../shared/services/pmsService';
import { PMS_DASHBOARD_CONFIG } from '../config/pmsDashboardConfig';

/**
 * usePMSDashboard — operational PMS dashboard via the shared useDashboardQuery.
 *
 * Composite fetch: the three round-trips (overview / designer-kra / alerts) run in
 * parallel and resolve to one object; kra/alerts failures degrade to null (as
 * before). Accepts a legacy period string OR a range object {preset,from,to}.
 * Returns the same shape as the previous hook: { data, kra, alerts, isLoading, error, refresh }.
 */
const fetchPMS = (range) =>
  Promise.all([
    pmsService.getDashboardOverview(range),
    pmsService.getDesignerKRA(range).catch(() => null),
    pmsService.getAlerts().catch(() => null), // alerts are live — no range
  ]).then(([overview, kra, alerts]) => ({
    overview: overview || null,
    kra: kra || null,
    alerts: alerts || null,
  }));

const usePMSDashboard = (range = 'month') => {
  const normalized = typeof range === 'string' ? { preset: range } : range;
  const { data, isLoading, error, refresh } = useDashboardQuery(fetchPMS, normalized, {
    pollMs: PMS_DASHBOARD_CONFIG.pollMs,
    errorMessage: PMS_DASHBOARD_CONFIG.errorMessage,
  });
  return {
    data:   data?.overview ?? null,
    kra:    data?.kra ?? null,
    alerts: data?.alerts ?? null,
    isLoading,
    error,
    refresh,
  };
};

export default usePMSDashboard;
