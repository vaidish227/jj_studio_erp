import { useState, useEffect, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';

/**
 * Contractors for one project. Each contractor carries embedded documents[].
 * File uploads/deletes are called directly from the tab; call refresh()
 * afterwards to re-pull. `counts` is keyed by status for the filter badges.
 */
const useContractors = (projectId) => {
  const [contractors, setContractors] = useState([]);
  const [counts, setCounts]           = useState({});
  const [isLoading, setIsLoading]     = useState(true);
  const [error, setError]             = useState(null);

  const load = useCallback(() => {
    if (!projectId) { setContractors([]); setCounts({}); setIsLoading(false); return; }
    setIsLoading(true);
    pmsService.getContractors(projectId)
      .then((res) => { setContractors(res.contractors || []); setCounts(res.counts || {}); setError(null); })
      .catch((err) => setError(err))
      .finally(() => setIsLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const createContractor = useCallback(async (data) => {
    const res = await pmsService.createContractor({ ...data, projectId });
    load();
    return res;
  }, [projectId, load]);

  const updateContractor = useCallback(async (id, data) => {
    const res = await pmsService.updateContractor(id, data);
    load();
    return res;
  }, [load]);

  const deleteContractor = useCallback(async (id) => {
    const res = await pmsService.deleteContractor(id);
    load();
    return res;
  }, [load]);

  return {
    contractors, counts, isLoading, error, refresh: load,
    createContractor, updateContractor, deleteContractor,
  };
};

export default useContractors;
