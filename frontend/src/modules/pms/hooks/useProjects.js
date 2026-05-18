import { useState, useEffect, useCallback, useMemo } from 'react';
import { pmsService } from '../../../shared/services/pmsService';
import { usePMS } from '../context/PMSContext';

const useProjects = (initialFilters = {}) => {
  const { projectsVersion } = usePMS();

  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);
  const [total, setTotal]         = useState(0);
  const [filters, setFilters]     = useState(initialFilters);

  // Async-only — no synchronous setState in effect body
  useEffect(() => {
    let cancelled = false;

    pmsService.getAllProjects(filters)
      .then((res) => {
        if (cancelled) return;
        setProjects(res.projects || []);
        setTotal(res.total || 0);
        setError(null);
      })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [filters, projectsVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // updateFilters resets loading before changing deps — event-handler context
  const updateFilters = useCallback((next) => {
    setIsLoading(true);
    setFilters((prev) => ({ ...prev, ...next }));
  }, []);

  const refresh = useCallback(() => {
    setIsLoading(true);
    setFilters((f) => ({ ...f })); // new reference → triggers effect
  }, []);

  const statusCounts = useMemo(() => projects.reduce(
    (acc, p) => {
      acc.total += 1;
      if (p.status === 'design_phase')    acc.design_phase    += 1;
      if (p.status === 'execution_phase') acc.execution_phase += 1;
      if (p.status === 'on_hold')         acc.on_hold         += 1;
      if (p.status === 'completed')       acc.completed       += 1;
      if (p.status === 'handover')        acc.handover        += 1;
      return acc;
    },
    { total: 0, design_phase: 0, execution_phase: 0, on_hold: 0, completed: 0, handover: 0 }
  ), [projects]);

  return { projects, isLoading, error, total, filters, updateFilters, refresh, statusCounts };
};

export default useProjects;
