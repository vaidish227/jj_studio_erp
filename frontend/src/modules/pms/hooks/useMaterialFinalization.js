import { useState, useEffect, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';

/**
 * Material Finalization entries for one project. Each entry carries embedded
 * images[] + documents[]. File uploads/deletes are called directly from the
 * tab; call refresh() afterwards to re-pull.
 */
const useMaterialFinalization = (projectId) => {
  const [entries, setEntries]     = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);

  const load = useCallback(() => {
    if (!projectId) { setEntries([]); setIsLoading(false); return; }
    setIsLoading(true);
    pmsService.getMaterialFinalizations(projectId)
      .then((res) => { setEntries(res.entries || []); setError(null); })
      .catch((err) => setError(err))
      .finally(() => setIsLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const createEntry = useCallback(async (data) => {
    const res = await pmsService.createMaterialFinalization({ ...data, projectId });
    load();
    return res;
  }, [projectId, load]);

  const updateEntry = useCallback(async (id, data) => {
    const res = await pmsService.updateMaterialFinalization(id, data);
    load();
    return res;
  }, [load]);

  const deleteEntry = useCallback(async (id) => {
    const res = await pmsService.deleteMaterialFinalization(id);
    load();
    return res;
  }, [load]);

  return { entries, isLoading, error, refresh: load, createEntry, updateEntry, deleteEntry };
};

export default useMaterialFinalization;
