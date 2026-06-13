import { useState, useEffect, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';

const useVendorEngagements = (projectId) => {
  const [engagements, setEngagements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await pmsService.getVendorEngagements(projectId);
      setEngagements(res.engagements || []);
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { engagements, isLoading, error, refresh };
};

export default useVendorEngagements;
