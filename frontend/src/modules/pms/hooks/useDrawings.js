import { useState, useEffect, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';

const useDrawings = (initialFilters = {}) => {
  const [filters, setFilters]     = useState(initialFilters);
  const [drawings, setDrawings]   = useState([]);
  const [total, setTotal]         = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);

  useEffect(() => {
    let cancelled = false;
    pmsService.getAllDrawings(filters)
      .then((res) => {
        if (!cancelled) {
          setDrawings(res.drawings || []);
          setTotal(res.total   || 0);
          setError(null);
        }
      })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [filters]);

  const refresh = useCallback(() => {
    setIsLoading(true);
    setFilters((f) => ({ ...f }));
  }, []);

  const updateFilter = useCallback((key, value) => {
    setIsLoading(true);
    setFilters((prev) => {
      const next = { ...prev };
      if (value === '' || value === null || value === undefined) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  }, []);

  return { drawings, total, isLoading, error, filters, setFilters, updateFilter, refresh };
};

export default useDrawings;
