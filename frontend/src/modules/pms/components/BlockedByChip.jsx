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

  // Compose a tight human label of what's blocking
  const depLabel = blockingTasks.length === 1
    ? blockingTasks[0].title
    : blockingTasks.length > 1
      ? `${blockingTasks.length} prerequisite tasks`
      : null;
  const gateLabel = blockingGates.length === 1
    ? blockingGates[0].label
    : blockingGates.length > 1
      ? `${blockingGates.length} approval gates`
      : null;
  const label = depLabel || gateLabel || 'a prerequisite';

  const handleOverride = async () => {
    if (reason.trim().length < 5) {
      toast.error('Override reason must be at least 5 characters');
      return;
    }
    setSubmitting(true);
    try {
      const res = await pmsService.overrideTaskGate(task._id, { overrideReason: reason.trim() });
      const n = res?.gatesOverridden?.length || 0;
      toast.success(
        n > 0
          ? `Task unblocked — ${n} gate${n === 1 ? '' : 's'} overridden`
          : 'Task unblocked'
      );
      setOpen(false);
      setReason('');
      onOverridden?.();
    } catch (err) {
      toast.error(err?.message || 'Failed to override gate');
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
            Blocked by: <span className="font-bold">{label}</span>
          </span>
        </div>
        {canOverride && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(true); }}
            className="shrink-0 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider
                       text-[var(--warning)] hover:text-[var(--warning)]/80 transition-colors"
          >
            <Unlock size={10} /> Override
          </button>
        )}
      </div>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Override Gate"
        className="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-[var(--text-muted)]">
            Overriding a gate unblocks this task without the prerequisite approval.
            The override is logged in the project activity feed and notifications are sent.
          </p>

          <FormField label="Reason for Override" required>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Client verbally approved layout — written confirmation pending"
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
              Override Gate
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default BlockedByChip;
