import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Range-aware dashboard data hook: fetch on range change, poll on an interval,
 * and KEEP the previous `data` across refetches so cards stay visible (the page
 * overlays a spinner instead of clearing).
 *
 * Generic over the data source — `fetcher` may call one endpoint or Promise.all
 * many; the hook just stores whatever it resolves to. Depends on the primitive
 * range fields (not the object) so a fresh `{…}` literal each render doesn't
 * churn the fetch/poll identity.
 *
 * @param {(range:{preset,from,to}) => Promise<any>} fetcher
 * @param {{preset?:string, from?:string, to?:string}} range
 * @param {{pollMs?:number, errorMessage?:string}} [options]
 * @returns {{data, isLoading, error, refresh}}
 */
const useDashboardQuery = (fetcher, range, { pollMs = 60000, errorMessage = 'Failed to load dashboard.' } = {}) => {
  const { preset, from, to } = range || {};
  const [state, setState] = useState({ data: null, isLoading: true, error: '' });
  const isMountedRef = useRef(true);

  // Keep the latest fetcher without making it a dependency (services are stable
  // singletons, but this avoids re-running on incidental identity changes).
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: '' }));
    try {
      const res = await fetcherRef.current({ preset, from, to });
      if (!isMountedRef.current) return;
      setState({ data: res ?? null, isLoading: false, error: '' });
    } catch (err) {
      if (!isMountedRef.current) return;
      setState((prev) => ({ ...prev, isLoading: false, error: err?.message || errorMessage }));
    }
  }, [preset, from, to, errorMessage]);

  useEffect(() => {
    isMountedRef.current = true;
    run();
    const intervalId = window.setInterval(run, pollMs);
    return () => {
      isMountedRef.current = false;
      window.clearInterval(intervalId);
    };
  }, [run, pollMs]);

  return { ...state, refresh: run };
};

export default useDashboardQuery;
