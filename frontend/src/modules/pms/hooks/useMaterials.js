import { useState, useEffect, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';

const useMaterials = (projectId) => {
  const [materials, setMaterials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);

  const load = useCallback(() => {
    if (!projectId) return;
    setIsLoading(true);
    pmsService.getMaterialsByProject(projectId)
      .then((res) => { setMaterials(res.materials || []); setError(null); })
      .catch((err) => setError(err))
      .finally(() => setIsLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const createMaterial = useCallback(async (data) => {
    const res = await pmsService.createMaterial({ ...data, projectId });
    load();
    return res;
  }, [projectId, load]);

  const updateMaterial = useCallback(async (id, data) => {
    const res = await pmsService.updateMaterial(id, data);
    load();
    return res;
  }, [load]);

  return { materials, isLoading, error, refresh: load, createMaterial, updateMaterial };
};

export default useMaterials;
