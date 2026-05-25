import { useState, useEffect, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';

const useReviewQueue = (filters = {}) => {
  const [tasks, setTasks]     = useState([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [total, setTotal]     = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await pmsService.getReviewQueue(filters);
      setTasks(res.tasks || []);
      setTotal(res.total || 0);
    } catch (e) {
      setError(e?.message || 'Failed to load review queue');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  return { tasks, isLoading, error, total, refresh: load };
};

export default useReviewQueue;
