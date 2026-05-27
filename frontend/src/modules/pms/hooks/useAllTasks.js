import { useState, useEffect, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';

const useAllTasks = (filters = {}) => {
  const [tasks, setTasks]       = useState([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError]       = useState(null);
  const [total, setTotal]       = useState(0);

  const filtersKey = JSON.stringify(filters);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await pmsService.getAllTasks(filters);
      setTasks(res.tasks || []);
      setTotal(res.total  || 0);
    } catch (err) {
      setError(err?.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [filtersKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  return { tasks, isLoading, error, total, refresh: fetchTasks };
};

export default useAllTasks;
