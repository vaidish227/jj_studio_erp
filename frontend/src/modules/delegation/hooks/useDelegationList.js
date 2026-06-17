import { useState, useEffect, useCallback } from 'react';
import { delegationService } from '../services/delegationService';

/**
 * Fetch a paginated, filtered delegation list. `filters` is a plain object of
 * query params (status, departmentId, priority, assignedTo, createdBy, overdue, q, page, limit).
 */
export const useDelegationList = (filters = {}) => {
  const [data, setData] = useState({ delegations: [], total: 0, page: 1, limit: 20 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const key = JSON.stringify(filters);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await delegationService.list(filters);
      setData({
        delegations: res.delegations || [],
        total: res.total || 0,
        page: res.page || 1,
        limit: res.limit || 20,
      });
    } catch (err) {
      setError(err?.message || 'Failed to load delegations');
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => { fetch(); }, [fetch]);

  return { ...data, isLoading, error, refresh: fetch };
};

export default useDelegationList;
