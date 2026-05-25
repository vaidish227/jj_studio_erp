import { useState, useEffect, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';

const useTaskDetail = (taskId) => {
  const [task, setTask]         = useState(null);
  const [drawings, setDrawings] = useState([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError]       = useState(null);

  const load = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setError(null);
    try {
      const [taskRes, drawingRes] = await Promise.all([
        pmsService.getTaskById(taskId),
        pmsService.getDrawingsByTask(taskId),
      ]);
      setTask(taskRes.task);
      setDrawings(drawingRes.drawings || []);
    } catch (e) {
      setError(e?.message || 'Failed to load task');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => { load(); }, [load]);

  return { task, drawings, isLoading, error, refresh: load, setTask };
};

export default useTaskDetail;
