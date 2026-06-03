import { useState, useEffect, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';

const useHandover = (projectId) => {
  const [handover, setHandover] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await pmsService.getHandover(projectId);
      setHandover(res?.handover || null);
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);
  return { handover, isLoading, error, refresh };
};

export default useHandover;
