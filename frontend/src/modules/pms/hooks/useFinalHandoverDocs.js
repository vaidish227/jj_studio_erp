import { useState, useEffect, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';

/**
 * Final Handover documents for one project (flat list, newest first).
 */
const useFinalHandoverDocs = (projectId) => {
  const [docs, setDocs]           = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState(null);
  const [tick, setTick]           = useState(0);

  useEffect(() => {
    if (!projectId) { setDocs([]); return undefined; }
    let cancelled = false;
    setIsLoading(true);
    pmsService.getFinalHandoverDocs(projectId)
      .then((res) => {
        if (!cancelled) { setDocs(res.documents || []); setError(null); }
      })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return { docs, isLoading, error, refresh };
};

export default useFinalHandoverDocs;
