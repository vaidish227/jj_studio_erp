import { useCallback, useEffect, useState } from 'react';
import { crmService } from '../../../shared/services/crmService';

const POLL_INTERVAL_MS = 30000;

// Same badge logic as the main dashboard so both Follow-ups panels read identically.
const getFollowupBadge = (dateValue) => {
  const now = new Date();
  const date = new Date(dateValue);
  const diff = date.setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0);

  if (diff < 0) return 'OVERDUE';
  if (diff === 0) return 'TODAY';
  return 'TOMORROW';
};

/**
 * Fetches pending follow-ups and maps them into the shape FollowUpsPanel
 * expects — mirroring the main Dashboard exactly so the panel looks the same
 * wherever it's used. Polls every 30s like the other dashboard surfaces.
 */
const useFollowups = (limit = 5) => {
  const [followups, setFollowups] = useState([]);

  const fetchFollowups = useCallback(async () => {
    try {
      const res = await crmService.getFollowups();
      const mapped = (res.followups || [])
        .filter((item) => item.status !== 'done')
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, limit)
        .map((item) => ({
          id: item._id,
          name: item.leadId?.name || 'Unknown Lead',
          project: item.note || 'Follow-up reminder',
          time: item.date ? new Date(item.date).toLocaleString('en-IN') : '—',
          status: getFollowupBadge(item.date),
        }));
      setFollowups(mapped);
    } catch {
      // Silent — the panel simply renders its empty state.
    }
  }, [limit]);

  useEffect(() => {
    fetchFollowups();
    const intervalId = window.setInterval(fetchFollowups, POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [fetchFollowups]);

  return followups;
};

export default useFollowups;
