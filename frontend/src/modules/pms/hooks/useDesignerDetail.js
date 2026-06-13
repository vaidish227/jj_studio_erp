import { useState, useEffect, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';

/**
 * useDesignerDetail — loads per-designer KPI / KRA detail from
 * GET /pms/dashboard/designer/:userId. Refetches on userId or period change.
 */
const useDesignerDetail = (userId, period = 'month') => {
  const [data, setData]         = useState(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError]       = useState(null);
  const [version, setVersion]   = useState(0);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    pmsService.getDesignerDetail(userId, period)
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
  }, [userId, period, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  return { data, isLoading, error, refresh };
};

export default useDesignerDetail;
