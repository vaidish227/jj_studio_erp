import { useState, useEffect, useCallback } from 'react';
import { delegationService } from '../services/delegationService';

/** Load a single delegation plus its comments and activity timeline. */
export const useDelegationDetail = (id) => {
  const [delegation, setDelegation] = useState(null);
  const [comments, setComments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    try {
      const [d, c, a] = await Promise.all([
        delegationService.get(id),
        delegationService.listComments(id),
        delegationService.activity(id),
      ]);
      setDelegation(d.delegation);
      setComments(c.comments || []);
      setActivity(a.activity || []);
    } catch (err) {
      setError(err?.message || 'Failed to load delegation');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  return { delegation, comments, activity, isLoading, error, refresh: load, setDelegation };
};

export default useDelegationDetail;
