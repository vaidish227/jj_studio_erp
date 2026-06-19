import { useState, useEffect, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';

/**
 * Snag list for one project. Returns snags + per-status counts for the filter
 * badges. Photo uploads/deletes are called directly from the tab; call
 * refresh() afterwards.
 */
const useSnags = (projectId) => {
  const [snags, setSnags]         = useState([]);
  const [counts, setCounts]       = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);

  const load = useCallback(() => {
    if (!projectId) { setSnags([]); setCounts({}); setIsLoading(false); return; }
    setIsLoading(true);
    pmsService.getSnags(projectId)
      .then((res) => { setSnags(res.snags || []); setCounts(res.counts || {}); setError(null); })
      .catch((err) => setError(err))
      .finally(() => setIsLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const createSnag = useCallback(async (data) => {
    const res = await pmsService.createSnag({ ...data, projectId });
    load();
    return res;
  }, [projectId, load]);

  const updateSnag = useCallback(async (id, data) => {
    const res = await pmsService.updateSnag(id, data);
    load();
    return res;
  }, [load]);

  const deleteSnag = useCallback(async (id) => {
    const res = await pmsService.deleteSnag(id);
    load();
    return res;
  }, [load]);

  return { snags, counts, isLoading, error, refresh: load, createSnag, updateSnag, deleteSnag };
};

export default useSnags;
