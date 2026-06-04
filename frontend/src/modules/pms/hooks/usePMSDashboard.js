import { useState, useEffect, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';

/**
 * usePMSDashboard — fetches the operational PMS dashboard overview.
 * Single round-trip to /pms/dashboard/overview. Re-fetches when `period` changes
 * or when `refresh()` is called.
 */
const usePMSDashboard = (period = 'month') => {
  const [data, setData]           = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);
  const [version, setVersion]     = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    pmsService.getDashboardOverview(period)
      .then((res) => {
        if (cancelled) return;
        setData(res || null);
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

  return { data, isLoading, error, refresh };
};

export default usePMSDashboard;
