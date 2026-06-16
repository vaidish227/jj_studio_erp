/**
 * Per-dashboard range persistence. The storage key and default range are
 * supplied by the caller (each dashboard's config) so dashboards persist
 * independently and can have different defaults.
 */
import { isValidRange } from './dateRangePresets';

export const loadRange = (storageKey, defaultRange) => {
  const fallback = { ...defaultRange };
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return isValidRange(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

export const saveRange = (storageKey, range) => {
  try {
    if (isValidRange(range)) localStorage.setItem(storageKey, JSON.stringify(range));
  } catch {
    /* ignore quota / private-mode write errors */
  }
};
