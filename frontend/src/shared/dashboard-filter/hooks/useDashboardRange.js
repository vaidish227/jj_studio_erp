import { useEffect, useState } from 'react';
import { loadRange, saveRange } from '../persistence';

/**
 * Dashboard range state with localStorage persistence.
 *
 * @param {string} storageKey   per-dashboard key (e.g. 'md_dashboard_range')
 * @param {object} defaultRange range used when nothing valid is stored
 * @returns {[range, setRange]}
 */
const useDashboardRange = (storageKey, defaultRange) => {
  const [range, setRange] = useState(() => loadRange(storageKey, defaultRange));
  useEffect(() => { saveRange(storageKey, range); }, [storageKey, range]);
  return [range, setRange];
};

export default useDashboardRange;
