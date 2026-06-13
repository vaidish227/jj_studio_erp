import React, { useState } from 'react';
import { Lock, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '../../../shared/components';
import { useAuth } from '../../../shared/context/AuthContext';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../shared/services/pmsService';

/**
 * WhatsBlockingWidget — Overview-tab summary of pending client approvals.
 *
 * Reads from `project.clientApprovals[]` (the canonical checklist powering the
 * Approvals tab) so the widget stays in sync with what users actually mark.
 * Previously this widget read from ApprovalGate docs, which after the gates
 * soft-disable (WORKFLOW_GATES_ENABLED=false) silently reported "all clear"
 * regardless of real checklist state.
 */

const APPROVAL_LABELS = {
  furniture_layout:    'Furniture Layout',
  ac:                  'AC Layout Approval',
  automation:          'Automation Design Approval',
  kitchen:             'Kitchen Design Approval',
  bathroom_material:   'Bathroom Material Selection',
  cp_fittings:         'CP Fittings Approval',
  wall_floor_material: 'Wall & Floor Material',
};
const APPROVAL_ORDER = Object.keys(APPROVAL_LABELS);

const WhatsBlockingWidget = ({ project, onSwitchToApprovals, onProjectUpdated }) => {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const projectId = project?._id;
  const [busyType, setBusyType] = useState(null);

  // Engine not seeded — don't render the widget (legacy project)
  if (!project?.workflowTemplateId) return null;

  // Merge canonical 7-item list with project.clientApprovals[] so types not
  // yet seeded default to "pending".
  const approvals = project.clientApprovals || [];
  const merged = APPROVAL_ORDER.map((type) => {
    const found = approvals.find((a) => a.type === type);
    return { type, status: found?.status || 'pending' };
  });
  const pending = merged.filter((a) => a.status === 'pending');

  if (pending.length === 0) {
    return (
      <div className="bg-[var(--success)]/8 border border-[var(--success)]/30 rounded-2xl p-4 flex items-center gap-3">
        <CheckCircle2 size={20} className="text-[var(--success)] shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-bold text-[var(--success)]">All clear</p>
          <p className="text-xs text-[var(--text-muted)]">All client approvals obtained — the project is moving smoothly.</p>
        </div>
      </div>
    );
  }

  const top = pending.slice(0, 3);
  const canMarkObtained = hasPermission('projects.update');

  const handleMarkObtained = async (type) => {
    setBusyType(type);
    try {
      await pmsService.updateClientApproval(projectId, {
        type,
        status: 'obtained',
        obtainedAt: new Date().toISOString(),
      });
      toast.success(`"${APPROVAL_LABELS[type] || type}" marked as approved`);
      onProjectUpdated?.();
    } catch (err) {
      toast.error(err?.message || 'Failed');
    } finally {
      setBusyType(null);
    }
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 lg:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-[var(--warning)]" />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Awaiting client approval</h3>
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--warning)] bg-[var(--warning)]/10 px-2 py-0.5 rounded">
            {pending.length} pending
          </span>
        </div>
        {onSwitchToApprovals && (
          <button
            type="button"
            onClick={onSwitchToApprovals}
            className="text-xs font-semibold text-[var(--primary)] hover:underline flex items-center gap-1"
          >
            View all <ArrowRight size={11} />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {top.map((a) => (
          <div
            key={a.type}
            className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg)] border border-[var(--border)]"
          >
            <Lock size={14} className="text-[var(--warning)] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                {APPROVAL_LABELS[a.type] || a.type}
              </p>
            </div>
            {canMarkObtained && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleMarkObtained(a.type)}
                disabled={busyType === a.type}
              >
                <CheckCircle2 size={12} className="mr-1" /> Mark Approved
              </Button>
            )}
          </div>
        ))}
      </div>

      {pending.length > 3 && (
        <p className="text-xs text-[var(--text-muted)] text-center pt-1">
          + {pending.length - 3} more pending approval{pending.length - 3 === 1 ? '' : 's'} — see Approvals tab
        </p>
      )}
    </div>
  );
};

export default WhatsBlockingWidget;
