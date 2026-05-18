import React, { useState } from 'react';
import { Rocket } from 'lucide-react';
import { Modal, Button } from '../../../shared/components';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';

const ReleaseDrawingModal = ({ isOpen, onClose, drawing, onReleased }) => {
  const toast = useToast();
  const [isSubmitting, setSubmitting] = useState(false);

  if (!drawing) return null;

  const handleRelease = async () => {
    setSubmitting(true);
    try {
      await pmsService.releaseDrawing(drawing._id);
      toast.success('Drawing released to site');
      onReleased?.();
      onClose();
    } catch (err) {
      toast.error(err || 'Failed to release drawing');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Release to Site">
      <div className="space-y-4">
        <div className="flex flex-col items-center text-center gap-3 py-4">
          <div className="w-14 h-14 rounded-2xl bg-[var(--success)]/10 flex items-center justify-center">
            <Rocket size={28} className="text-[var(--success)]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">
              Release "{drawing.title}" to site?
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              v{drawing.version} · This action cannot be undone.
              The drawing status and any linked task will be updated to <strong>Released to Site</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleRelease} isLoading={isSubmitting}>
            <Rocket size={14} className="mr-1" />
            Release to Site
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ReleaseDrawingModal;
