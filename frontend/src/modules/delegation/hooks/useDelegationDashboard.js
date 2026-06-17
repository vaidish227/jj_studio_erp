import { useState, useEffect, useCallback } from 'react';
import { delegationService } from '../services/delegationService';

export const useDelegationDashboard = () => {
  const [data, setData] = useState({ kpis: {}, workload: [], recentActivity: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await delegationService.dashboard();
      setData({
        kpis: res.kpis || {},
        workload: res.workload || [],
        recentActivity: res.recentActivity || [],
      });
    } catch (err) {
      setError(err?.message || 'Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { ...data, isLoading, error, refresh: fetch };
};

export default useDelegationDashboard;
