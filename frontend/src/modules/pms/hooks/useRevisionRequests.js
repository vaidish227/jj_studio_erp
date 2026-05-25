import { useState, useEffect, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';

const useRevisionRequests = (drawingId) => {
  const [requests, setRequests] = useState([]);
  const [isLoading, setLoading] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!drawingId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await pmsService.getRevisionRequestsByDrawing(drawingId);
      setRequests(res.revisionRequests || []);
    } catch (e) {
      setError(e?.message || 'Failed to load revision requests');
    } finally {
      setLoading(false);
    }
  }, [drawingId]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (data) => {
    setSubmitting(true);
    try {
      const res = await pmsService.createRevisionRequest({ drawingId, ...data });
      setRequests((prev) => [res.revisionRequest, ...prev]);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e?.message || 'Failed to create revision request' };
    } finally {
      setSubmitting(false);
    }
  }, [drawingId]);

  const resolve = useCallback(async (id) => {
    setSubmitting(true);
    try {
      await pmsService.resolveRevisionRequest(id);
      setRequests((prev) =>
        prev.map((r) => r._id === id ? { ...r, status: 'resolved', resolvedAt: new Date() } : r)
      );
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e?.message || 'Failed to resolve request' };
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { requests, isLoading, isSubmitting, error, create, resolve, refresh: load };
};

export default useRevisionRequests;
