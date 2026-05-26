import { useState, useEffect, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';

const useDesignerDashboard = () => {
  const [data, setData]         = useState(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError]       = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await pmsService.getDesignerDashboard();
      setData(res);
    } catch (e) {
      setError(e?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { data, isLoading, error, refresh: load };
};

export default useDesignerDashboard;
