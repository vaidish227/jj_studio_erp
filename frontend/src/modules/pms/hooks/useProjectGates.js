import { useState, useEffect, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';

/**
 * useProjectGates — Phase 2 hook for the ProjectGatesTab.
 * Polls the GET /api/pms/project/:id/gates endpoint and exposes a refresh fn.
 */
const useProjectGates = (projectId) => {
  const [gates, setGates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await pmsService.getProjectGates(projectId);
      setGates(res.gates || []);
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { gates, isLoading, error, refresh };
};

export default useProjectGates;
