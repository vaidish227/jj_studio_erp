import React, { useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { useAuth } from '../../../shared/context/AuthContext';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { Modal, Button, FormField } from '../../../shared/components';
import { pmsService } from '../../../shared/services/pmsService';

/**
 * BlockedByChip — visual + actionable indicator that a task is blocked by the
 * workflow engine. Reads `task.dependsOn` and `task.gateStatus` plus the task
 * status. Backwards-compatible: renders nothing if task isn't blocked.
 *
 * When the current user has `tasks.override_gate`, an inline "Override" button
 * opens a modal that captures `overrideReason` and calls the override endpoint.
 *
 * For Phase 1 the override endpoint is not yet wired (Phase 2 will add a
 * dedicated REST path); the chip falls back to a toast explaining that the
 * override must be applied via the next gated action (which carries the
 * `overrideReason` body field).
 */
const BlockedByChip = ({ task, blockingTasks = [], blockingGates = [], onOverridden }) => {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Show only when task is actually blocked
  const isBlocked = task?.status === 'blocked' || task?.gateStatus === 'open';
  if (!isBlocked) return null;

  const canOverride = hasPermission('tasks.override_gate');

  // Compose a tight human label of what's pending
  const depLabel = blockingTasks.length === 1
    ? blockingTasks[0].title
    : blockingTasks.length > 1
      ? `${blockingTasks.length} earlier task${blockingTasks.length === 1 ? '' : 's'}`
      : null;
  const gateLabel = blockingGates.length === 1
    ? blockingGates[0].label
    : blockingGates.length > 1
      ? `${blockingGates.length} approval${blockingGates.length === 1 ? '' : 's'}`
      : null;
  const label = depLabel || gateLabel || 'an earlier step';

  const handleOverride = async () => {
    if (reason.trim().length < 5) {
      toast.error('Reason must be at least 5 characters');
      return;
    }
    setSubmitting(true);
    try {
      const res = await pmsService.overrideTaskGate(task._id, { overrideReason: reason.trim() });
      const n = res?.gatesOverridden?.length || 0;
      toast.success(
        n > 0
          ? `Task ready to start — ${n} sign-off${n === 1 ? '' : 's'} confirmed verbally`
          : 'Task ready to start'
      );
      setOpen(false);
      setReason('');
      onOverridden?.();
    } catch (err) {
      toast.error(err?.message || 'Could not confirm verbally');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div
        className="mt-2 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg
                   bg-[var(--warning)]/8 border border-[var(--warning)]/20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Lock size={12} className="text-[var(--warning)] shrink-0" />
          <span className="text-[11px] text-[var(--warning)] truncate">
            Waiting on: <span className="font-bold">{label}</span>
          </span>
        </div>
        {canOverride && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(true); }}
            className="shrink-0 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider
                       text-[var(--warning)] hover:text-[var(--warning)]/80 transition-colors"
          >
            <Unlock size={10} /> Confirm Verbally
          </button>
        )}
      </div>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Confirm Verbally"
        className="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-[var(--text-muted)]">
            Use this when the client has approved verbally and written confirmation will follow.
            This task can then start immediately. The action is recorded in the project activity feed
            and notifications are sent.
          </p>

          <FormField label="Reason / note" required>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Client verbally approved layout on call — written confirmation pending"
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]
                         text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                         focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30
                         focus:border-[var(--primary)] resize-none"
            />
          </FormField>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleOverride} isLoading={submitting}>
              <Unlock size={13} className="mr-1.5" />
              Confirm & Continue
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default BlockedByChip;
