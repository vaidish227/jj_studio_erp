import { useState, useEffect, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';

const useActivityLog = (projectId) => {
  const [logs, setLogs]           = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const LIMIT = 30;

  const load = useCallback((p = 1) => {
    if (!projectId) return;
    setIsLoading(true);
    pmsService.getProjectActivity(projectId, { page: p, limit: LIMIT })
      .then((res) => {
        setLogs(p === 1 ? (res.logs || []) : (prev) => [...prev, ...(res.logs || [])]);
        setTotal(res.total || 0);
        setPage(p);
        setError(null);
      })
      .catch((err) => setError(err))
      .finally(() => setIsLoading(false));
  }, [projectId]);

  useEffect(() => { load(1); }, [load]);

  const loadMore = useCallback(() => { load(page + 1); }, [load, page]);
  const hasMore  = logs.length < total;

  return { logs, isLoading, error, total, hasMore, loadMore, refresh: () => load(1) };
};

export default useActivityLog;
