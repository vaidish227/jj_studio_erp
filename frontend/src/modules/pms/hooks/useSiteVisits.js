import { useState, useEffect, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';

const useSiteVisits = (projectId) => {
  const [visits, setVisits]       = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);

  const load = useCallback(() => {
    if (!projectId) return;
    setIsLoading(true);
    pmsService.getSiteVisitsByProject(projectId)
      .then((res) => { setVisits(res.visits || []); setError(null); })
      .catch((err) => setError(err))
      .finally(() => setIsLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const createVisit = useCallback(async (data) => {
    const res = await pmsService.createSiteVisit({ ...data, projectId });
    load();
    return res;
  }, [projectId, load]);

  const updateVisit = useCallback(async (id, data) => {
    const res = await pmsService.updateSiteVisit(id, data);
    load();
    return res;
  }, [load]);

  return { visits, isLoading, error, refresh: load, createVisit, updateVisit };
};

export default useSiteVisits;
