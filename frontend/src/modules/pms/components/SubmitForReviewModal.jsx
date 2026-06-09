import React, { useState } from 'react';
import { Send, X, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '../../../shared/components';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';

/**
 * `drawingCount` (optional) — when 0, the modal blocks submission with a
 * clear message; when >0, it confirms how many drawings will be sent.
 * Callers should also disable the OPEN button when count is 0 so this is
 * a defense-in-depth check, not the primary gate.
 */
const SubmitForReviewModal = ({ task, isOpen, onClose, onSubmitted, drawingCount = null }) => {
  const toast = useToast();
  const [notes, setNotes]   = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen || !task) return null;

  const hasNoDrawings = drawingCount === 0;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const res = await pmsService.submitTask(task._id, { submissionNotes: notes });
      toast.success('Task submitted for review');
      onSubmitted?.(res.task);
      onClose();
    } catch (e) {
      toast.error(e?.message || 'Failed to submit task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center">
              <Send size={16} className="text-[var(--primary)]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Submit for Review</h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate max-w-[220px]">{task.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mt-0.5">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-[var(--text-secondary)] mb-4 leading-relaxed">
          This will send your task and any linked drawings to the project manager for review.
          You will be notified once reviewed.
        </p>

        {hasNoDrawings ? (
          <div className="mb-4 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[var(--warning)]/10 border border-[var(--warning)]/30">
            <AlertTriangle size={14} className="text-[var(--warning)] shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--warning)] leading-snug">
              <span className="font-bold">No drawing uploaded.</span>{' '}
              Please upload a drawing before submitting — the reviewer needs something to review.
            </p>
          </div>
        ) : drawingCount > 0 ? (
          <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--success)]/8 border border-[var(--success)]/20">
            <FileText size={12} className="text-[var(--success)]" />
            <p className="text-xs text-[var(--success)]">
              {drawingCount} drawing{drawingCount !== 1 ? 's' : ''} will be sent for review.
            </p>
          </div>
        ) : null}

        {/* Notes */}
        <div className="space-y-1.5 mb-5">
          <label className="block text-xs font-semibold text-[var(--text-secondary)]">
            Submission Notes <span className="font-normal text-[var(--text-muted)]">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Describe what you've completed, any decisions made, or things the reviewer should know…"
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg)]
                       text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                       focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || hasNoDrawings}>
            <Send size={14} className="mr-1.5" />
            {saving ? 'Submitting…' : 'Submit for Review'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SubmitForReviewModal;
