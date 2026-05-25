import { useState, useEffect, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';

/**
 * Manages WhatsApp groups for a single project.
 * Pass projectId to scope to one project; omit for cross-project use (e.g. global page).
 */
const useWhatsAppGroups = (projectId) => {
  const [groups, setGroups]       = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);
  const [version, setVersion]     = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!projectId) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    pmsService.getWhatsAppGroupsByProject(projectId)
      .then((res) => {
        if (!cancelled) {
          setGroups(res.data?.groups || res.groups || []);
          setError(null);
        }
      })
      .catch((err) => { if (!cancelled) setError(err?.response?.data?.message || err.message); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, version]);

  const createGroup = useCallback(async (data) => {
    const res = await pmsService.createWhatsAppGroup({ ...data, projectId });
    refresh();
    return res.data;
  }, [projectId, refresh]);

  const updateGroup = useCallback(async (id, data) => {
    const res = await pmsService.updateWhatsAppGroup(id, data);
    refresh();
    return res.data;
  }, [refresh]);

  const deleteGroup = useCallback(async (id) => {
    await pmsService.deleteWhatsAppGroup(id);
    refresh();
  }, [refresh]);

  const addMember = useCallback(async (groupId, memberData) => {
    const res = await pmsService.addWhatsAppGroupMember(groupId, memberData);
    refresh();
    return res.data;
  }, [refresh]);

  const removeMember = useCallback(async (groupId, phone) => {
    const res = await pmsService.removeWhatsAppGroupMember(groupId, phone);
    refresh();
    return res.data;
  }, [refresh]);

  const syncGroup = useCallback(async (groupId) => {
    const res = await pmsService.syncWhatsAppGroup(groupId);
    refresh();
    return res.data;
  }, [refresh]);

  const sendUpdate = useCallback(async (groupId, data) => {
    const res = await pmsService.sendWhatsAppGroupUpdate(groupId, data);
    refresh();
    return res.data;
  }, [refresh]);

  return {
    groups,
    isLoading,
    error,
    refresh,
    createGroup,
    updateGroup,
    deleteGroup,
    addMember,
    removeMember,
    syncGroup,
    sendUpdate,
  };
};

export default useWhatsAppGroups;
