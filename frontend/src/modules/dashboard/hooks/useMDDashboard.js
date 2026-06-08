import { useCallback, useEffect, useRef, useState } from 'react';
import { mdDashboardService } from '../../../shared/services/mdDashboardService';

const POLL_INTERVAL_MS = 60000;

const useMDDashboard = (period = 'month') => {
  const [state, setState] = useState({
    data: null,
    isLoading: true,
    error: '',
  });

  const isMountedRef = useRef(true);

  const fetchOverview = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: '' }));
    try {
      const res = await mdDashboardService.getMDOverview(period);
      if (!isMountedRef.current) return;
      setState({
        data: res ?? null,
        isLoading: false,
        error: '',
      });
    } catch (err) {
      if (!isMountedRef.current) return;
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err?.message || 'Failed to load MD dashboard.',
      }));
    }
  }, [period]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchOverview();
    const intervalId = window.setInterval(fetchOverview, POLL_INTERVAL_MS);
    return () => {
      isMountedRef.current = false;
      window.clearInterval(intervalId);
    };
  }, [fetchOverview]);

  return {
    ...state,
    refresh: fetchOverview,
  };
};

export default useMDDashboard;
