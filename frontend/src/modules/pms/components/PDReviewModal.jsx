import React, { useState } from 'react';
import { Eye, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Modal, Button, FormField, Select } from '../../../shared/components';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../shared/services/pmsService';

/**
 * PDReviewModal — Phase 2.
 *
 * Dual-purpose modal:
 *   mode = "request"  → designer requests Principal Designer review on a drawing
 *   mode = "respond"  → Principal Designer records approve / reject for the latest pending review
 */
const PDReviewModal = ({ drawing, mode = 'request', isOpen, onClose, onDone }) => {
  const toast = useToast();
  const [decision, setDecision] = useState('approved');
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!drawing) return null;

  const handleRequest = async () => {
    setSubmitting(true);
    try {
      const res = await pmsService.requestPDReview(drawing._id, {
        notes: comments.trim() || undefined,
      });
      toast.success(res.skipped ? 'PD review already requested' : 'Principal Designer review requested');
      onDone?.();
      onClose();
      setComments('');
    } catch (err) {
      toast.error(err?.message || 'Failed to request PD review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRespond = async () => {
    if (decision !== 'approved' && comments.trim().length < 5) {
      toast.error('Please provide reason / change request (min 5 chars)');
      return;
    }
    setSubmitting(true);
    try {
      await pmsService.respondPDReview(drawing._id, {
        status: decision,
        comments: comments.trim() || undefined,
      });
      toast.success(
        decision === 'approved'
          ? 'Approved — gate closed, drawing cleared for client.'
          : 'Sent back for revision'
      );
      onDone?.();
      onClose();
      setComments('');
    } catch (err) {
      toast.error(err?.message || 'Failed to record response');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'request' ? 'Request Principal Designer Review' : 'Principal Designer Review'}
      className="max-w-md"
    >
      <div className="space-y-4">
        <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Drawing</p>
          <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5">{drawing.title}</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            v{drawing.version} · {drawing.drawingType}
          </p>
        </div>

        {mode === 'respond' && (
          <FormField label="Decision" required>
            <Select
              value={decision}
              onChange={(value) => setDecision(value)}
              options={[
                { value: 'approved',              label: 'Approve — cleared for client meeting' },
                { value: 'approved_with_changes', label: 'Approve with changes — designer iterates' },
                { value: 'rejected',              label: 'Reject — send back for revision' },
              ]}
            />
          </FormField>
        )}

        <FormField label={mode === 'respond' && decision !== 'approved' ? 'Reason / Changes Required' : 'Notes (optional)'}>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={3}
            placeholder={
              mode === 'respond' && decision !== 'approved'
                ? 'Describe what needs to change…'
                : 'Optional context…'
            }
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]
                       text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                       focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30
                       focus:border-[var(--primary)] resize-none"
          />
        </FormField>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          {mode === 'request' ? (
            <Button onClick={handleRequest} isLoading={submitting}>
              <Eye size={13} className="mr-1.5" /> Send to PD
            </Button>
          ) : (
            <Button onClick={handleRespond} isLoading={submitting}>
              {decision === 'approved' ? (
                <><ThumbsUp size={13} className="mr-1.5" /> Approve</>
              ) : (
                <><ThumbsDown size={13} className="mr-1.5" /> Submit</>
              )}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default PDReviewModal;
