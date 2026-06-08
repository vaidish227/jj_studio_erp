import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Unlock, ArrowRight, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '../../../shared/components';
import { useAuth } from '../../../shared/context/AuthContext';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../shared/services/pmsService';
import useProjectGates from '../hooks/useProjectGates';

/**
 * WhatsBlockingWidget — Phase 3a.
 *
 * Surfaced on the Overview tab so a PM doesn't need to switch tabs to know
 * "what's blocking this project right now". Shows the top 3 open gates by age
 * with one-click actions:
 *
 *   - For client/principal_and_client gates with a linked listensTo →
 *     "Mark Client Obtained" button (cycles Project.clientApprovals[type])
 *   - For everyone with tasks.override_gate → "Override" inline button
 *   - "View all gates" link → switches to the Gates tab via parent prop
 *
 * Empty state when nothing is blocking: green ✓ "All clear" panel.
 */

const APPROVER_BADGE = {
  client:               { label: 'CLIENT',      cls: 'bg-[var(--accent-blue)]/12 text-[var(--accent-blue)]' },
  manager:              { label: 'MANAGER',     cls: 'bg-[var(--text-muted)]/12 text-[var(--text-muted)]' },
  principal_designer:   { label: 'PD',          cls: 'bg-[var(--primary)]/12 text-[var(--primary)]' },
  principal_and_client: { label: 'PD + CLIENT', cls: 'bg-[var(--warning)]/12 text-[var(--warning)]' },
};

const ageLabel = (d) => {
  if (d <= 0) return 'today';
  if (d === 1) return '1 day';
  return `${d} days`;
};

const WhatsBlockingWidget = ({ project, onSwitchToGates }) => {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const projectId = project?._id;
  const { gates, isLoading, refresh } = useProjectGates(projectId);

  const [busyId, setBusyId] = useState(null);

  // Engine not seeded — don't render the widget (legacy project)
  if (!project?.workflowTemplateId) return null;
  if (isLoading) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 text-sm text-[var(--text-muted)]">
        Loading sign-offs…
      </div>
    );
  }

  const open = gates.filter((g) => g.status === 'open');
  // Sort by age desc — oldest items surface first
  const top = open.sort((a, b) => (b.ageingDays || 0) - (a.ageingDays || 0)).slice(0, 3);

  if (open.length === 0) {
    return (
      <div className="bg-[var(--success)]/8 border border-[var(--success)]/30 rounded-2xl p-4 flex items-center gap-3">
        <CheckCircle2 size={20} className="text-[var(--success)] shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-bold text-[var(--success)]">All clear</p>
          <p className="text-xs text-[var(--text-muted)]">No sign-offs pending — the project is moving smoothly.</p>
        </div>
      </div>
    );
  }

  const handleMarkObtained = async (gate) => {
    if (!gate.listensTo) {
      toast.error('This sign-off has no linked client approval.');
      return;
    }
    setBusyId(gate._id);
    try {
      await pmsService.updateClientApproval(projectId, {
        type: gate.listensTo,
        status: 'obtained',
        obtainedAt: new Date().toISOString(),
      });
      toast.success(`"${gate.listensTo}" marked as approved`);
      refresh();
    } catch (err) {
      toast.error(err?.message || 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 lg:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-[var(--warning)]" />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Awaiting your approval</h3>
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--warning)] bg-[var(--warning)]/10 px-2 py-0.5 rounded">
            {open.length} pending
          </span>
        </div>
        {onSwitchToGates && (
          <button
            type="button"
            onClick={onSwitchToGates}
            className="text-xs font-semibold text-[var(--primary)] hover:underline flex items-center gap-1"
          >
            View all <ArrowRight size={11} />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {top.map((gate) => {
          const badge = APPROVER_BADGE[gate.approverType] || APPROVER_BADGE.client;
          const canOverride = hasPermission('tasks.override_gate');
          const canMarkObtained =
            hasPermission('projects.update') && gate.listensTo &&
            (gate.approverType === 'client' || gate.approverType === 'principal_and_client');
          const isHybrid = gate.approverType === 'principal_and_client';

          return (
            <div
              key={gate._id}
              className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg)] border border-[var(--border)]"
            >
              <Lock size={14} className="text-[var(--warning)] shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${badge.cls}`}>
                    {badge.label}
                  </span>
                  {isHybrid && gate.pdApproval?.status === 'approved' && (
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--success)] bg-[var(--success)]/12 px-1.5 py-0.5 rounded">
                      PD ✓
                    </span>
                  )}
                  {isHybrid && gate.clientApproval?.status === 'obtained' && (
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--success)] bg-[var(--success)]/12 px-1.5 py-0.5 rounded">
                      CLIENT ✓
                    </span>
                  )}
                  <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-0.5 ml-auto shrink-0">
                    <Clock size={9} /> {ageLabel(gate.ageingDays || 0)}
                  </span>
                </div>
                <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{gate.label}</p>
                {gate.blockingTasks?.length > 0 && (
                  <p className="text-[11px] text-[var(--text-muted)] truncate">
                    {gate.blockingTasks.length} task{gate.blockingTasks.length === 1 ? '' : 's'} waiting to start
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {canMarkObtained && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleMarkObtained(gate)}
                    disabled={busyId === gate._id}
                  >
                    <CheckCircle2 size={12} className="mr-1" /> Mark Approved
                  </Button>
                )}
                {canOverride && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onSwitchToGates?.()}
                    title="Open Sign-offs tab to confirm verbally"
                  >
                    <Unlock size={12} />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {open.length > 3 && (
        <p className="text-xs text-[var(--text-muted)] text-center pt-1">
          + {open.length - 3} more pending sign-off{open.length - 3 === 1 ? '' : 's'} — see Sign-offs tab
        </p>
      )}
    </div>
  );
};

export default WhatsBlockingWidget;
