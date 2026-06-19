import { useState, useEffect, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';

/**
 * useDesignerDetail — loads per-designer KPI / KRA detail from
 * GET /pms/dashboard/designer/:userId. Refetches on userId or range change.
 *
 * `range` is the shared dashboard-filter descriptor ({ preset } | { preset:'custom',
 * from, to }) or a legacy period string — both are understood by the service.
 */
const useDesignerDetail = (userId, range = 'month') => {
  const [data, setData]         = useState(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError]       = useState(null);
  const [version, setVersion]   = useState(0);

  // Stringify so a fresh object identity each render doesn't refetch needlessly.
  const rangeKey = typeof range === 'string' ? range : JSON.stringify(range);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    pmsService.getDesignerDetail(userId, range)
      .then((res) => {
        if (cancelled) return;
        setData(res || null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.message || err?.message || 'Failed to load designer detail');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, rangeKey, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  return { data, isLoading, error, refresh };
};

export default useDesignerDetail;
