import { useState, useEffect, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';

const usePurchaseOrders = (projectId) => {
  const [pos, setPos]             = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);

  const load = useCallback(() => {
    if (!projectId) return;
    setIsLoading(true);
    pmsService.getPOsByProject(projectId)
      .then((res) => { setPos(res.pos || []); setError(null); })
      .catch((err) => setError(err))
      .finally(() => setIsLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const createPO = useCallback(async (data) => {
    const res = await pmsService.createPO({ ...data, projectId });
    load();
    return res;
  }, [projectId, load]);

  const updatePO = useCallback(async (id, data) => {
    const res = await pmsService.updatePO(id, data);
    load();
    return res;
  }, [load]);

  const deletePO = useCallback(async (id) => {
    await pmsService.deletePO(id);
    load();
  }, [load]);

  return { pos, isLoading, error, refresh: load, createPO, updatePO, deletePO };
};

export default usePurchaseOrders;
