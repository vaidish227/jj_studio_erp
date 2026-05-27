import { useState, useEffect, useCallback } from 'react';
import { pmsService } from '../../../shared/services/pmsService';

const useDesignComments = (drawingId) => {
  const [comments, setComments]   = useState([]);
  const [isLoading, setLoading]   = useState(false);
  const [isPosting, setPosting]   = useState(false);
  const [error, setError]         = useState(null);

  const load = useCallback(async () => {
    if (!drawingId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await pmsService.getDrawingComments(drawingId);
      setComments(res.comments || []);
    } catch (e) {
      setError(e?.message || 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [drawingId]);

  useEffect(() => { load(); }, [load]);

  const addComment = useCallback(async ({ content, commentType, attachmentUrl }) => {
    setPosting(true);
    try {
      const res = await pmsService.addDrawingComment(drawingId, {
        content,
        commentType,
        attachmentUrl: attachmentUrl || undefined,
      });
      setComments((prev) => [...prev, res.comment]);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e?.message || 'Failed to add comment' };
    } finally {
      setPosting(false);
    }
  }, [drawingId]);

  return { comments, isLoading, isPosting, error, addComment, refresh: load };
};

export default useDesignComments;
