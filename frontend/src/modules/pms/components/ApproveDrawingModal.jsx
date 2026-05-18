import React, { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Modal, Button, FormField } from '../../../shared/components';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';

const ApproveDrawingModal = ({ isOpen, onClose, drawing, onDone }) => {
  const toast = useToast();
  const [mode, setMode]                     = useState('approve'); // 'approve' | 'reject'
  const [remarks, setRemarks]               = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setSubmitting]       = useState(false);
  const [rejectError, setRejectError]       = useState('');

  if (!drawing) return null;

  const reset = () => {
    setMode('approve'); setRemarks(''); setRejectionReason(''); setRejectError('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      await pmsService.approveDrawing(drawing._id, { remarks: remarks.trim() });
      toast.success('Drawing approved');
      reset();
      onDone?.();
      onClose();
    } catch (err) {
      toast.error(err || 'Failed to approve drawing');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) { setRejectError('Rejection reason is required'); return; }
    setSubmitting(true);
    try {
      await pmsService.rejectDrawing(drawing._id, { rejectionReason: rejectionReason.trim() });
      toast.success('Drawing rejected');
      reset();
      onDone?.();
      onClose();
    } catch (err) {
      toast.error(err || 'Failed to reject drawing');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Review Drawing">
      <div className="space-y-4">

        {/* Drawing info */}
        <div className="px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{drawing.title}</p>
          <p className="text-xs text-[var(--text-muted)]">
            v{drawing.version} · by {drawing.uploadedBy?.name || '—'}
          </p>
          {drawing.fileUrl && (
            <a
              href={drawing.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--primary)] hover:underline"
            >
              Open file ↗
            </a>
          )}
        </div>

        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode('approve')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all
              ${mode === 'approve'
                ? 'border-[var(--success)] bg-[var(--success)]/10 text-[var(--success)]'
                : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--success)]/40'}`}
          >
            <CheckCircle2 size={15} />
            Approve
          </button>
          <button
            type="button"
            onClick={() => { setMode('reject'); setRejectError(''); }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all
              ${mode === 'reject'
                ? 'border-[var(--error)] bg-[var(--error)]/10 text-[var(--error)]'
                : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--error)]/40'}`}
          >
            <XCircle size={15} />
            Reject
          </button>
        </div>

        {/* Approve mode */}
        {mode === 'approve' && (
          <FormField label="Remarks (optional)">
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              placeholder="Any comments for the designer..."
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]
                         text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                         focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30
                         focus:border-[var(--primary)] resize-none transition-colors"
            />
          </FormField>
        )}

        {/* Reject mode */}
        {mode === 'reject' && (
          <FormField label="Rejection Reason" error={rejectError} required>
            <textarea
              value={rejectionReason}
              onChange={(e) => { setRejectionReason(e.target.value); setRejectError(''); }}
              rows={3}
              placeholder="Explain what needs to be corrected..."
              className={`w-full px-3 py-2 rounded-lg border bg-[var(--bg)]
                         text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                         focus:outline-none focus:ring-2 resize-none transition-colors
                         ${rejectError
                           ? 'border-[var(--error)] focus:ring-[var(--error)]/30'
                           : 'border-[var(--border)] focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]'}`}
            />
          </FormField>
        )}

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>Cancel</Button>
          {mode === 'approve'
            ? <Button onClick={handleApprove} isLoading={isSubmitting}>Confirm Approval</Button>
            : <Button variant="danger" onClick={handleReject} isLoading={isSubmitting}>Confirm Rejection</Button>
          }
        </div>
      </div>
    </Modal>
  );
};

export default ApproveDrawingModal;
