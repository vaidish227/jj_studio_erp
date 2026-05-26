import { useState, useEffect, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';

const useMilestones = (projectId) => {
  const [milestones, setMilestones] = useState([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [error, setError]           = useState(null);

  const load = useCallback(() => {
    if (!projectId) return;
    setIsLoading(true);
    pmsService.getMilestonesByProject(projectId)
      .then((res) => { setMilestones(res.milestones || []); setError(null); })
      .catch((err) => setError(err))
      .finally(() => setIsLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const createMilestone = useCallback(async (data) => {
    const res = await pmsService.createMilestone({ ...data, projectId });
    load();
    return res;
  }, [projectId, load]);

  const updateMilestone = useCallback(async (id, data) => {
    const res = await pmsService.updateMilestone(id, data);
    load();
    return res;
  }, [load]);

  const deleteMilestone = useCallback(async (id) => {
    await pmsService.deleteMilestone(id);
    load();
  }, [load]);

  return { milestones, isLoading, error, refresh: load, createMilestone, updateMilestone, deleteMilestone };
};

export default useMilestones;
