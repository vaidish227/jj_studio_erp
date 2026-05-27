import { useState, useEffect, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';
import { usePMS } from '../context/PMSContext';

const useProjectDetail = (projectId) => {
  const { setActiveProject } = usePMS();

  const [project, setProject]     = useState(null);
  const [tasks, setTasks]         = useState([]);
  const [drawings, setDrawings]   = useState([]);
  const [siteLogs, setSiteLogs]   = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);
  const [version, setVersion]     = useState(0);
  const [tasksVer, setTasksVer]   = useState(0);
  const [drawVer, setDrawVer]     = useState(0);

  // Full fetch — async only, no synchronous setState in body
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    Promise.all([
      pmsService.getProjectById(projectId),
      pmsService.getTasksByProject(projectId),
      pmsService.getDrawingsByProject(projectId),
      pmsService.getSiteLogsByProject(projectId).catch(() => ({ logs: [] })),
    ])
      .then(([projRes, taskRes, drawRes, logRes]) => {
        if (cancelled) return;
        setProject(projRes.project);
        setActiveProject(projRes.project);
        setTasks(taskRes.tasks   || []);
        setDrawings(drawRes.drawings || []);
        setSiteLogs(logRes.logs  || []);
        setError(null);
      })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [projectId, version]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tasks-only re-fetch (skips first render)
  useEffect(() => {
    if (!projectId || tasksVer === 0) return;
    let cancelled = false;
    pmsService.getTasksByProject(projectId)
      .then((res) => { if (!cancelled) setTasks(res.tasks || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [projectId, tasksVer]);

  // Drawings-only re-fetch (skips first render)
  useEffect(() => {
    if (!projectId || drawVer === 0) return;
    let cancelled = false;
    pmsService.getDrawingsByProject(projectId)
      .then((res) => { if (!cancelled) setDrawings(res.drawings || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [projectId, drawVer]);

  // refresh() sets loading BEFORE bumping version so it's in an event-handler
  // context, not the effect body — satisfying the React 19 compiler rule
  const refresh = useCallback(() => {
    setIsLoading(true);
    setVersion((v) => v + 1);
  }, []);

  const refreshTasks    = useCallback(() => setTasksVer((v) => v + 1), []);
  const refreshDrawings = useCallback(() => setDrawVer((v)  => v + 1), []);

  return {
    project, tasks, drawings, siteLogs,
    isLoading, error,
    refresh, refreshTasks, refreshDrawings,
  };
};

export default useProjectDetail;
