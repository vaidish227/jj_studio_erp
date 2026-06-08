import { useState, useEffect, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';

/**
 * usePMSDashboard — fetches the operational PMS dashboard.
 *
 * Three parallel round-trips:
 *   - /pms/dashboard/overview     → KPIs, projects, gates, activity
 *   - /pms/dashboard/designer-kra → KPI/KRA scoreboard for the period
 *   - /pms/dashboard/alerts       → consolidated alerts feed for AlertsSection
 *
 * Re-fetches when `period` changes or `refresh()` is called.
 */
const usePMSDashboard = (period = 'month') => {
  const [data, setData]           = useState(null);
  const [kra, setKra]             = useState(null);
  const [alerts, setAlerts]       = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);
  const [version, setVersion]     = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    Promise.all([
      pmsService.getDashboardOverview(period),
      pmsService.getDesignerKRA(period).catch(() => null),
      pmsService.getAlerts().catch(() => null),
    ])
      .then(([overview, kraRes, alertsRes]) => {
        if (cancelled) return;
        setData(overview || null);
        setKra(kraRes || null);
        setAlerts(alertsRes || null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load dashboard');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [period, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  return { data, kra, alerts, isLoading, error, refresh };
};

export default usePMSDashboard;
