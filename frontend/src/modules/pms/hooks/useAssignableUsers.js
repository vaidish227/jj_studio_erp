import { useState, useEffect } from 'react';
import { pmsService } from '../../../shared/services/pmsService';

const useAssignableUsers = () => {
  const [users, setUsers]       = useState([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    let cancelled = false;
    pmsService.getAssignableUsers()
      .then((res) => { if (!cancelled) setUsers(res.users || []); })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { users, isLoading, error };
};

export default useAssignableUsers;
