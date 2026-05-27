import { useState, useEffect, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';

const useVendors = () => {
  const [category, setCategory]   = useState('');
  const [vendors, setVendors]     = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);
  const [version, setVersion]     = useState(0);

  useEffect(() => {
    let cancelled = false;
    const params = category ? { category } : {};
    pmsService.getVendors(params)
      .then((res) => {
        if (!cancelled) { setVendors(res.vendors || []); setError(null); }
      })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [category, version]);

  const refresh = useCallback(() => {
    setIsLoading(true);
    setVersion((v) => v + 1);
  }, []);

  const filterByCategory = useCallback((cat) => {
    setIsLoading(true);
    setCategory(cat);
  }, []);

  return { vendors, isLoading, error, category, filterByCategory, refresh };
};

export default useVendors;
