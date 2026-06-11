import { useState, useEffect, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';

/**
 * Document Repository data for one project.
 * Returns the full document list (client-side category/search filtering keeps
 * tab switches instant) plus per-category counts from the backend.
 */
const useProjectDocuments = (projectId) => {
  const [documents, setDocuments] = useState([]);
  const [counts, setCounts]       = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState(null);
  const [tick, setTick]           = useState(0);

  useEffect(() => {
    if (!projectId) {
      setDocuments([]);
      setCounts({});
      return undefined;
    }
    let cancelled = false;
    setIsLoading(true);
    pmsService.getProjectDocuments(projectId)
      .then((res) => {
        if (!cancelled) {
          setDocuments(res.documents || []);
          setCounts(res.counts || {});
          setError(null);
        }
      })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return { documents, counts, isLoading, error, refresh };
};

export default useProjectDocuments;
