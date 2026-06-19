import { useState, useEffect, useCallback } from 'react';
import { delegationService } from '../services/delegationService';

export const useDelegationDashboard = () => {
  const [data, setData] = useState({
    kpis: {},
    summary: {},
    statusMix: [],
    priorityMix: [],
    trend: [],
    workload: [],
    assignees: [],
    aging: [],
    attention: [],
    recentActivity: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await delegationService.dashboard();
      setData({
        kpis: res.kpis || {},
        summary: res.summary || {},
        statusMix: res.statusMix || [],
        priorityMix: res.priorityMix || [],
        trend: res.trend || [],
        workload: res.workload || [],
        assignees: res.assignees || [],
        aging: res.aging || [],
        attention: res.attention || [],
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
