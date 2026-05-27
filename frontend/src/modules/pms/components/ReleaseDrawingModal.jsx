import React, { useState } from 'react';
import { Rocket, CheckSquare, Square } from 'lucide-react';
import { Modal, Button } from '../../../shared/components';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';

const RELEASE_CHECKLIST = [
  'Release complete set of drawings',
  'Print in A3/A4 as per design',
  'Release all reference pictures',
  'Release all 3D after rectification if needed',
  '3D after written rectification uploaded to DLR',
];

const ReleaseDrawingModal = ({ isOpen, onClose, drawing, onReleased }) => {
  const toast = useToast();
  const [checked, setChecked]         = useState([]);
  const [isSubmitting, setSubmitting] = useState(false);

  if (!drawing) return null;

  const toggle = (idx) =>
    setChecked((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );

  const allChecked = checked.length === RELEASE_CHECKLIST.length;

  const handleClose = () => {
    setChecked([]);
    onClose();
  };

  const handleRelease = async () => {
    setSubmitting(true);
    try {
      await pmsService.releaseDrawing(drawing._id);
      toast.success('Drawing released to site');
      setChecked([]);
      onReleased?.();
      onClose();
    } catch (err) {
      toast.error(err || 'Failed to release drawing');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Release to Site">
      <div className="space-y-5">

        {/* Drawing context */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)]">
          <div className="w-9 h-9 rounded-lg bg-[var(--success)]/10 flex items-center justify-center shrink-0">
            <Rocket size={18} className="text-[var(--success)]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{drawing.title}</p>
            <p className="text-xs text-[var(--text-muted)]">v{drawing.version} · Approved</p>
          </div>
        </div>

        {/* Site release checklist */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)]">
              Site Release Checklist
            </p>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full transition-colors
              ${allChecked
                ? 'bg-[var(--success)]/10 text-[var(--success)]'
                : 'bg-[var(--border)] text-[var(--text-muted)]'}`}>
              {checked.length}/{RELEASE_CHECKLIST.length}
            </span>
          </div>

          <div className="space-y-1">
            {RELEASE_CHECKLIST.map((item, idx) => {
              const done = checked.includes(idx);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggle(idx)}
                  className={`w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl
                             border transition-all duration-100
                             ${done
                               ? 'border-[var(--success)]/30 bg-[var(--success)]/5'
                               : 'border-[var(--border)] hover:border-[var(--primary)]/30 hover:bg-[var(--primary)]/3'}`}
                >
                  {done
                    ? <CheckSquare size={15} className="text-[var(--success)] shrink-0" />
                    : <Square      size={15} className="text-[var(--text-muted)] shrink-0" />
                  }
                  <span className={`text-xs transition-colors ${done ? 'text-[var(--text-secondary)] line-through' : 'text-[var(--text-primary)]'}`}>
                    {item}
                  </span>
                </button>
              );
            })}
          </div>

          {!allChecked && (
            <p className="text-[11px] text-[var(--text-muted)] mt-2 px-1">
              Confirm all items before releasing to site.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-1 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleRelease}
            isLoading={isSubmitting}
            disabled={!allChecked || isSubmitting}
          >
            <Rocket size={14} className="mr-1.5" />
            Release to Site
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ReleaseDrawingModal;
