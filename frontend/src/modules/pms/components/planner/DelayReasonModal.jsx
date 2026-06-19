import { useEffect, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { ModalShell } from './sheetCells';

/**
 * DelayReasonModal — captures a required reason for a schedule change.
 * Two modes:
 *   - 'reason'      : plain reason capture (manual delay / block).
 *   - 'shiftConfirm': confirms a cascading shift, listing how many dependents
 *                     will move.
 *
 * Props:
 *   open, mode, title, affectedCount, busy, onClose, onConfirm(reason)
 */
const DelayReasonModal = ({ open, mode = 'reason', title, affectedCount = 0, busy, onClose, onConfirm }) => {
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) setReason(''); }, [open]);
  if (!open) return null;

  const canSubmit = reason.trim().length > 0 && !busy;
  const isShift = mode === 'shiftConfirm';

  return (
    <ModalShell
      title={isShift ? 'Confirm Schedule Shift' : 'Reason Required'}
      subtitle={title}
      onClose={onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={busy}
            className="px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)] disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={() => onConfirm(reason.trim())} disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[var(--primary)] rounded-lg hover:opacity-90 disabled:opacity-50">
            {busy && <Loader2 size={12} className="animate-spin" />} {isShift ? 'Shift Schedule' : 'Save'}
          </button>
        </>
      )}
    >
      {isShift && affectedCount > 0 && (
        <div className="mb-3 flex items-start gap-2 text-[11px] text-[var(--warning)] bg-[var(--warning)]/10 border border-[var(--warning)]/30 rounded-lg px-3 py-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>This will also shift <strong>{affectedCount}</strong> dependent task{affectedCount === 1 ? '' : 's'}, preserving each task's duration.</span>
        </div>
      )}
      <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Reason / Remark</label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={4}
        autoFocus
        placeholder="e.g. Client feedback delayed material selection…"
        className="w-full px-2.5 py-2 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--primary)] resize-none"
      />
    </ModalShell>
  );
};

export default DelayReasonModal;
