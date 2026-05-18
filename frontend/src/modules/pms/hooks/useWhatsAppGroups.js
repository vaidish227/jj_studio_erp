import { useState, useEffect, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';

const useWhatsAppGroups = (projectId) => {
  const [groups, setGroups]       = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);

  const load = useCallback(() => {
    if (!projectId) return;
    setIsLoading(true);
    pmsService.getWhatsAppGroupsByProject(projectId)
      .then((res) => { setGroups(res.groups || []); setError(null); })
      .catch((err) => setError(err))
      .finally(() => setIsLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const createGroup = useCallback(async (data) => {
    const res = await pmsService.createWhatsAppGroup({ ...data, projectId });
    load();
    return res;
  }, [projectId, load]);

  const updateGroup = useCallback(async (id, data) => {
    const res = await pmsService.updateWhatsAppGroup(id, data);
    load();
    return res;
  }, [load]);

  const deleteGroup = useCallback(async (id) => {
    await pmsService.deleteWhatsAppGroup(id);
    load();
  }, [load]);

  const sendUpdate = useCallback(async (id, data) => {
    return pmsService.sendWhatsAppGroupUpdate(id, data);
  }, []);

  return { groups, isLoading, error, refresh: load, createGroup, updateGroup, deleteGroup, sendUpdate };
};

export default useWhatsAppGroups;
