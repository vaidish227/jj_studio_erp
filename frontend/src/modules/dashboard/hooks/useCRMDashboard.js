import { useCallback, useEffect, useRef, useState } from 'react';
import { crmService } from '../../../shared/services/crmService';

const POLL_INTERVAL_MS = 30000;

const useCRMDashboard = (range = '3m') => {
  const [state, setState] = useState({
    data: null,
    isLoading: true,
    error: '',
  });

  const isMountedRef = useRef(true);

  const fetchDashboard = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: '' }));
    try {
      const res = await crmService.getCRMDashboard(range);
      if (!isMountedRef.current) return;
      setState({
        data: res?.data ?? null,
        isLoading: false,
        error: '',
      });
    } catch (err) {
      if (!isMountedRef.current) return;
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err?.message || 'Failed to load CRM dashboard.',
      }));
    }
  }, [range]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchDashboard();
    const intervalId = window.setInterval(fetchDashboard, POLL_INTERVAL_MS);
    return () => {
      isMountedRef.current = false;
      window.clearInterval(intervalId);
    };
  }, [fetchDashboard]);

  return {
    ...state,
    refresh: fetchDashboard,
  };
};

export default useCRMDashboard;
