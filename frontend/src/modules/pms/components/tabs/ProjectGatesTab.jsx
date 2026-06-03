import React, { useState } from 'react';
import { Lock, Unlock, CheckCircle2, Clock, AlertTriangle, ArrowRight, Send, Mail } from 'lucide-react';
import { useAuth } from '../../../../shared/context/AuthContext';
import { useToast } from '../../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../../shared/services/pmsService';
import { Modal, Button, FormField } from '../../../../shared/components';
import useProjectGates from '../../hooks/useProjectGates';

/**
 * ProjectGatesTab — Phase 2.
 * Answers "what is blocking this project right now?".
 *
 * Renders each ApprovalGate with: status badge, approver type, blocking tasks/activities,
 * aging in days, override status, and the next action button:
 *   - Mark Approval Obtained (project-level client approval)
 *   - Send Approval Request (open Approvals modal — falls back to existing requestApproval API)
 *   - Override Gate          (gated by tasks.override_gate)
 */

const STATUS_BADGE = {
  open:       { label: 'OPEN',       cls: 'bg-[var(--warning)]/15 text-[var(--warning)]' },
  closed:     { label: 'CLOSED',     cls: 'bg-[var(--success)]/15 text-[var(--success)]' },
  overridden: { label: 'OVERRIDDEN', cls: 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]' },
};

const APPROVER_LABEL = {
  client:                 'Client',
  manager:                'Manager',
  principal_designer:     'Principal Designer',
  principal_and_client:   'Principal Designer + Client',
};

const fmtAge = (days) => {
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day';
  return `${days} days`;
};

const GateCard = ({ gate, projectId, onRefresh }) => {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canOverride = hasPermission('tasks.override_gate');
  const canRecordClientApproval = hasPermission('projects.update');

  const badge = STATUS_BADGE[gate.status] || STATUS_BADGE.open;
  const isHybrid = gate.approverType === 'principal_and_client';
  const isOpen = gate.status === 'open';

  const handleMarkObtained = async () => {
    if (!gate.listensTo) {
      toast.error('This gate is not linked to a client-approval field.');
      return;
    }
    setSubmitting(true);
    try {
      await pmsService.updateClientApproval(projectId, {
        type: gate.listensTo,
        status: 'obtained',
        obtainedAt: new Date().toISOString(),
      });
      toast.success(`Approval "${gate.listensTo}" marked obtained`);
      onRefresh?.();
    } catch (err) {
      toast.error(err?.message || 'Failed to update approval');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOverride = async () => {
    if (reason.trim().length < 5) {
      toast.error('Reason must be at least 5 characters');
      return;
    }
    setSubmitting(true);
    try {
      const res = await pmsService.overrideProjectGate(projectId, gate._id, {
        overrideReason: reason.trim(),
      });
      toast.success(`Gate overridden — ${res?.tasksUnblocked ?? 0} task(s) unblocked`);
      setOverrideOpen(false);
      setReason('');
      onRefresh?.();
    } catch (err) {
      toast.error(err?.message || 'Override failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 lg:p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${badge.cls}`}>
                {badge.label}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                {APPROVER_LABEL[gate.approverType] || gate.approverType}
              </span>
              {isHybrid && (
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--primary)] bg-[var(--primary)]/10 px-1.5 py-0.5 rounded">
                  HYBRID
                </span>
              )}
            </div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">{gate.label}</h3>
          </div>
          <div className="flex items-center gap-1 text-xs text-[var(--text-muted)] shrink-0">
            <Clock size={12} />
            <span>Open for {fmtAge(gate.ageingDays)}</span>
          </div>
        </div>

        {/* Hybrid approval chips */}
        {isHybrid && (
          <div className="flex flex-wrap gap-2">
            <ApprovalChip
              label="Principal Designer"
              ok={gate.pdApproval?.status === 'approved'}
            />
            <ApprovalChip
              label="Client"
              ok={gate.clientApproval?.status === 'obtained'}
            />
          </div>
        )}

        {/* Linked client approval row (for pure client gates) */}
        {!isHybrid && gate.clientApproval && (
          <div className="text-xs text-[var(--text-muted)]">
            Linked approval: <span className="font-semibold">{gate.listensTo}</span> · status{' '}
            <span className={
              gate.clientApproval.status === 'obtained'
                ? 'text-[var(--success)] font-bold'
                : 'text-[var(--warning)] font-bold'
            }>
              {gate.clientApproval.status}
            </span>
          </div>
        )}

        {/* Blocking tasks */}
        {gate.blockingTasks?.length > 0 && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
              Blocking {gate.blockingTasks.length} task{gate.blockingTasks.length === 1 ? '' : 's'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {gate.blockingTasks.slice(0, 6).map((t) => (
                <span
                  key={t._id}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)]"
                  title={t.taskType}
                >
                  <Lock size={9} /> {t.title}
                </span>
              ))}
              {gate.blockingTasks.length > 6 && (
                <span className="text-[11px] text-[var(--text-muted)]">
                  +{gate.blockingTasks.length - 6} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Blocking activities */}
        {gate.blockedActivities?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {gate.blockedActivities.map((a) => (
              <span
                key={a}
                className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--warning)]/10 text-[var(--warning)] font-bold"
              >
                Blocks: {a}
              </span>
            ))}
          </div>
        )}

        {/* Override note */}
        {gate.status === 'overridden' && (
          <div className="bg-[var(--accent-blue)]/8 border border-[var(--accent-blue)]/20 rounded-lg p-3 text-xs">
            <p className="font-bold text-[var(--accent-blue)] mb-1">Overridden</p>
            {gate.overrideReason && <p className="text-[var(--text-secondary)]">{gate.overrideReason}</p>}
          </div>
        )}

        {/* Closed badge */}
        {gate.status === 'closed' && gate.closedAt && (
          <p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
            <CheckCircle2 size={12} className="text-[var(--success)]" />
            Closed {new Date(gate.closedAt).toLocaleDateString('en-IN')}
          </p>
        )}

        {/* Actions */}
        {isOpen && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border)]">
            {(gate.approverType === 'client' || isHybrid) && gate.listensTo && canRecordClientApproval && (
              <Button size="sm" variant="primary" onClick={handleMarkObtained} disabled={submitting}>
                <CheckCircle2 size={13} className="mr-1.5" /> Mark Client Approval Obtained
              </Button>
            )}
            {canOverride && (
              <Button size="sm" variant="outline" onClick={() => setOverrideOpen(true)}>
                <Unlock size={13} className="mr-1.5" /> Override
              </Button>
            )}
          </div>
        )}
      </div>

      <Modal isOpen={overrideOpen} onClose={() => setOverrideOpen(false)} title={`Override ${gate.label}`} className="max-w-md">
        <div className="space-y-4">
          <p className="text-xs text-[var(--text-muted)]">
            Override unblocks dependent tasks without the prerequisite approval.
            Logged in the project activity feed.
          </p>
          <FormField label="Override reason" required>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Client gave verbal approval — written confirmation pending"
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]
                         text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                         focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30
                         focus:border-[var(--primary)] resize-none"
            />
          </FormField>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
            <Button variant="ghost" onClick={() => setOverrideOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleOverride} isLoading={submitting}>
              <Unlock size={13} className="mr-1.5" /> Override Gate
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

const ApprovalChip = ({ label, ok }) => (
  <span
    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg ${
      ok
        ? 'bg-[var(--success)]/12 text-[var(--success)] border border-[var(--success)]/30'
        : 'bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/30'
    }`}
  >
    {ok ? <CheckCircle2 size={11} /> : <Clock size={11} />} {label}
  </span>
);

const ProjectGatesTab = ({ project }) => {
  const projectId = project?._id;
  const { gates, isLoading, error, refresh } = useProjectGates(projectId);

  const open       = gates.filter((g) => g.status === 'open');
  const overridden = gates.filter((g) => g.status === 'overridden');
  const closed     = gates.filter((g) => g.status === 'closed');

  if (!projectId) return null;

  if (error) {
    return (
      <div className="p-6 text-center text-sm text-[var(--error)]">
        <AlertTriangle size={20} className="mx-auto mb-2" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-2 lg:gap-4">
        <StatCard label="Open" count={open.length} tone="warning" icon={<Lock size={14} />} />
        <StatCard label="Overridden" count={overridden.length} tone="accent" icon={<Unlock size={14} />} />
        <StatCard label="Closed" count={closed.length} tone="success" icon={<CheckCircle2 size={14} />} />
      </div>

      {isLoading && gates.length === 0 && (
        <p className="text-center text-sm text-[var(--text-muted)] py-8">Loading gates…</p>
      )}

      {/* Open first — that's "what is blocking us" */}
      {open.length > 0 && (
        <Section title={`Blocking the project (${open.length})`}>
          {open.map((g) => <GateCard key={g._id} gate={g} projectId={projectId} onRefresh={refresh} />)}
        </Section>
      )}

      {overridden.length > 0 && (
        <Section title="Overridden">
          {overridden.map((g) => <GateCard key={g._id} gate={g} projectId={projectId} onRefresh={refresh} />)}
        </Section>
      )}

      {closed.length > 0 && (
        <Section title="Closed">
          {closed.map((g) => <GateCard key={g._id} gate={g} projectId={projectId} onRefresh={refresh} />)}
        </Section>
      )}

      {gates.length === 0 && !isLoading && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 text-center">
          <p className="text-sm text-[var(--text-muted)] mb-2">
            No workflow gates on this project.
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            Gates are created automatically when a project is initiated through the Workflow Engine.
          </p>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ label, count, tone, icon }) => {
  const toneCls =
    tone === 'warning' ? 'text-[var(--warning)]' :
    tone === 'success' ? 'text-[var(--success)]' :
    'text-[var(--accent-blue)]';
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3 lg:p-4">
      <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${toneCls}`}>
        {icon} {label}
      </div>
      <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">{count}</p>
    </div>
  );
};

const Section = ({ title, children }) => (
  <div>
    <h2 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-3">{title}</h2>
    <div className="space-y-3">{children}</div>
  </div>
);

export default ProjectGatesTab;
