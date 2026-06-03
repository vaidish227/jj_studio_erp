import React, { useState } from 'react';
import {
  Truck, FileText, CheckCircle2, AlertTriangle, Plus, X,
  ThumbsUp, ThumbsDown, PenLine, Shield, Trash2,
} from 'lucide-react';
import { Modal, Button, FormField, Input, Select } from '../../../../shared/components';
import { useAuth } from '../../../../shared/context/AuthContext';
import { useToast } from '../../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../../shared/services/pmsService';
import useHandover from '../../hooks/useHandover';

/**
 * HandoverTab — Phase 3b.
 *
 * Single tab on ProjectDetailPage that drives the entire Design → Execution
 * handover flow:
 *
 *   - "Request Handover" CTA — only shown when no handover exists yet
 *   - Drawing walkthrough — checkboxes per drawing in the snapshot
 *   - Punch list — raise issues + resolve
 *   - "Design Lead Sign" CTA — gated on walkthrough complete + no open blockers
 *   - "Supervisor Accept / Reject" CTAs — gated on design lead signed
 *
 * On acceptance, gate_handover closes via the engine and Project.phase → execution.
 */

const STATUS_BADGE = {
  requested: { label: 'REQUESTED', cls: 'bg-[var(--warning)]/12 text-[var(--warning)]' },
  signed:    { label: 'SIGNED',    cls: 'bg-[var(--accent-blue)]/12 text-[var(--accent-blue)]' },
  accepted:  { label: 'ACCEPTED',  cls: 'bg-[var(--success)]/12 text-[var(--success)]' },
  rejected:  { label: 'REJECTED',  cls: 'bg-[var(--error)]/12 text-[var(--error)]' },
};

const SEVERITY_CLS = {
  minor:    'text-[var(--accent-blue)]',
  major:    'text-[var(--warning)]',
  blocker:  'text-[var(--error)]',
};

const fmt = (d) => d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

// ── Request handover modal ───────────────────────────────────────────────────
const RequestModal = ({ projectId, isOpen, onClose, onCreated }) => {
  const toast = useToast();
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await pmsService.requestHandover(projectId, { notes });
      toast.success('Handover requested');
      onCreated?.();
      onClose();
    } catch (err) {
      const msg = err?.code === 'NO_DRAWINGS'
        ? 'No drawings to hand over. Approve + release drawings first.'
        : err?.message || 'Failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Request Handover" className="max-w-md">
      <div className="space-y-4">
        <p className="text-xs text-[var(--text-muted)]">
          Opens the handover package with all released + approved drawings. Supervisor will be notified.
        </p>
        <FormField label="Notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]
                       text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                       focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30
                       focus:border-[var(--primary)] resize-none"
            placeholder="Anything the supervisor should know about…"
          />
        </FormField>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={submitting}>
            <Truck size={13} className="mr-1.5" /> Request Handover
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// ── Sign / Accept / Reject modals ────────────────────────────────────────────
const ActionModal = ({ title, label, isOpen, onClose, onSubmit, requireReason, submitting }) => {
  const toast = useToast();
  const [notes, setNotes] = useState('');

  const handle = async () => {
    if (requireReason && notes.trim().length < 5) {
      toast.error('Reason must be at least 5 characters');
      return;
    }
    onSubmit(notes.trim());
    setNotes('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} className="max-w-md">
      <div className="space-y-4">
        <FormField label={requireReason ? 'Reason' : 'Notes (optional)'} required={requireReason}>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]
                       text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                       focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 resize-none"
          />
        </FormField>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handle} isLoading={submitting}>{label}</Button>
        </div>
      </div>
    </Modal>
  );
};

// ── Punch list panel ─────────────────────────────────────────────────────────
const PunchList = ({ handover, onChanged }) => {
  const toast = useToast();
  const [desc, setDesc] = useState('');
  const [severity, setSeverity] = useState('minor');
  const [adding, setAdding] = useState(false);
  const [resolving, setResolving] = useState(null);

  const locked = handover.status === 'accepted';

  const handleAdd = async () => {
    if (desc.trim().length < 3) return toast.error('Description too short');
    setAdding(true);
    try {
      await pmsService.addHandoverPunch(handover._id, { description: desc.trim(), severity });
      setDesc('');
      setSeverity('minor');
      onChanged?.();
    } catch (err) {
      toast.error(err?.message || 'Failed');
    } finally {
      setAdding(false);
    }
  };

  const handleResolve = async (item) => {
    const resolution = window.prompt('Resolution (min 3 chars):');
    if (!resolution || resolution.trim().length < 3) return;
    setResolving(item._id);
    try {
      await pmsService.resolveHandoverPunch(handover._id, item._id, { resolution: resolution.trim() });
      toast.success('Punch item resolved');
      onChanged?.();
    } catch (err) {
      toast.error(err?.message || 'Failed');
    } finally {
      setResolving(null);
    }
  };

  const unresolvedBlockers = handover.punchList.filter((p) => p.severity === 'blocker' && !p.resolvedAt).length;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 lg:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-[var(--warning)]" />
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Punch List</h3>
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
          {handover.punchList.length} item{handover.punchList.length === 1 ? '' : 's'}
        </span>
        {unresolvedBlockers > 0 && (
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--error)] bg-[var(--error)]/10 px-1.5 py-0.5 rounded">
            {unresolvedBlockers} BLOCKER OPEN
          </span>
        )}
      </div>

      {!locked && (
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Raise an issue for handover…"
            className="flex-1"
          />
          <Select
            value={severity}
            onChange={(v) => setSeverity(v)}
            options={[
              { value: 'minor',   label: 'Minor' },
              { value: 'major',   label: 'Major' },
              { value: 'blocker', label: 'Blocker' },
            ]}
          />
          <Button onClick={handleAdd} disabled={adding}>
            <Plus size={13} className="mr-1" /> Add
          </Button>
        </div>
      )}

      <div className="space-y-1.5">
        {handover.punchList.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] italic py-2">No issues raised.</p>
        )}
        {handover.punchList.map((item) => {
          const isResolved = !!item.resolvedAt;
          return (
            <div
              key={item._id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border
                ${isResolved
                  ? 'bg-[var(--success)]/5 border-[var(--success)]/20 opacity-70'
                  : 'bg-[var(--bg)] border-[var(--border)]'}`}
            >
              <span className={`text-[10px] font-black uppercase tracking-widest ${SEVERITY_CLS[item.severity]}`}>
                {item.severity}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-xs ${isResolved ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
                  {item.description}
                </p>
                <p className="text-[10px] text-[var(--text-muted)]">
                  {item.raisedBy?.name || '—'} · {fmt(item.raisedAt)}
                  {isResolved && ` · resolved: ${item.resolution}`}
                </p>
              </div>
              {!isResolved && !locked && (
                <button
                  type="button"
                  onClick={() => handleResolve(item)}
                  disabled={resolving === item._id}
                  className="text-[10px] font-bold uppercase tracking-wider text-[var(--success)] hover:underline shrink-0"
                >
                  Resolve
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Drawing walkthrough panel ────────────────────────────────────────────────
const DrawingWalkthrough = ({ handover, onChanged }) => {
  const toast = useToast();
  const [busyId, setBusyId] = useState(null);
  const locked = handover.status === 'accepted';

  const handleToggle = async (item) => {
    setBusyId(item._id);
    try {
      await pmsService.updateHandoverDrawing(handover._id, item._id, { walked: !item.walked });
      onChanged?.();
    } catch (err) {
      toast.error(err?.message || 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  const walkedCount = handover.drawings.filter((d) => d.walked).length;
  const total = handover.drawings.length;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 lg:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <FileText size={16} className="text-[var(--primary)]" />
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Drawing Walkthrough</h3>
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-auto">
          {walkedCount}/{total}
        </span>
      </div>

      <div className="space-y-1.5">
        {handover.drawings.map((d) => (
          <button
            key={d._id}
            type="button"
            onClick={() => !locked && handleToggle(d)}
            disabled={locked || busyId === d._id}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors
              ${d.walked
                ? 'bg-[var(--success)]/8 border-[var(--success)]/25'
                : 'bg-[var(--bg)] border-[var(--border)] hover:border-[var(--primary)]/40'}
              ${locked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
          >
            {d.walked
              ? <CheckCircle2 size={16} className="text-[var(--success)] shrink-0" />
              : <span className="w-4 h-4 rounded-full border-2 border-[var(--border)] shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${d.walked ? 'line-through text-[var(--text-muted)]' : 'font-semibold text-[var(--text-primary)]'} truncate`}>
                {d.title}
              </p>
              <p className="text-[10px] text-[var(--text-muted)]">
                v{d.version} · {d.drawingType}
                {d.walkedAt && ` · walked ${fmt(d.walkedAt)}`}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// ── Empty state — no handover yet ────────────────────────────────────────────
const EmptyState = ({ projectId, drawings, onRefresh }) => {
  const { hasPermission } = useAuth();
  const [open, setOpen] = useState(false);
  const releasedCount = drawings?.filter?.((d) => d.isReleased || d.status === 'released_to_site' || d.status === 'approved').length || 0;

  return (
    <>
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 lg:p-8 text-center space-y-3">
        <Truck size={32} className="mx-auto text-[var(--primary)] opacity-60" />
        <h3 className="text-base font-bold text-[var(--text-primary)]">No handover package yet</h3>
        <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">
          When all design drawings are approved and released, the design lead can open the handover package to walk the supervisor through the complete drawing set.
        </p>
        <p className="text-xs text-[var(--text-muted)]">
          {releasedCount} drawing(s) released or approved.
        </p>
        {hasPermission('projects.update') && (
          <Button onClick={() => setOpen(true)} disabled={releasedCount === 0}>
            <Truck size={13} className="mr-1.5" /> Request Handover
          </Button>
        )}
      </div>
      <RequestModal projectId={projectId} isOpen={open} onClose={() => setOpen(false)} onCreated={onRefresh} />
    </>
  );
};

// ── Main tab ─────────────────────────────────────────────────────────────────
const HandoverTab = ({ project, drawings = [] }) => {
  const projectId = project?._id;
  const { handover, isLoading, error, refresh } = useHandover(projectId);
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [signOpen, setSignOpen] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!projectId) return null;
  if (isLoading) return <p className="text-sm text-[var(--text-muted)] text-center py-8">Loading handover…</p>;
  if (error) {
    return (
      <div className="bg-[var(--error)]/8 border border-[var(--error)]/20 rounded-2xl p-4 text-sm text-[var(--error)]">
        <AlertTriangle size={14} className="inline mr-2" /> {error}
      </div>
    );
  }
  if (!handover) {
    return <EmptyState projectId={projectId} drawings={drawings} onRefresh={refresh} />;
  }

  const badge = STATUS_BADGE[handover.status] || STATUS_BADGE.requested;
  const unwalked = handover.drawings.filter((d) => !d.walked).length;
  const unresolvedBlockers = handover.punchList.filter((p) => p.severity === 'blocker' && !p.resolvedAt).length;
  const canSign = handover.status === 'requested' && unwalked === 0 && unresolvedBlockers === 0 && hasPermission('projects.update');
  const canAccept = handover.status === 'signed' && hasPermission('projects.update');
  const canReject = ['requested', 'signed'].includes(handover.status) && hasPermission('projects.update');

  const doSign = async (notes) => {
    setSubmitting(true);
    try {
      await pmsService.signHandover(handover._id, { notes });
      toast.success('Signed by design lead');
      setSignOpen(false);
      refresh();
    } catch (err) {
      const msg = err?.code === 'WALKTHROUGH_INCOMPLETE'
        ? `${unwalked} drawing(s) not yet walked through`
        : err?.code === 'BLOCKERS_OPEN'
          ? 'Blocker punch items must be resolved first'
          : err?.message || 'Failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const doAccept = async (notes) => {
    setSubmitting(true);
    try {
      await pmsService.acceptHandover(handover._id, { notes });
      toast.success('Handover accepted — project in execution phase');
      setAcceptOpen(false);
      refresh();
    } catch (err) {
      toast.error(err?.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const doReject = async (rejectionReason) => {
    setSubmitting(true);
    try {
      await pmsService.rejectHandover(handover._id, { rejectionReason });
      toast.success('Handover rejected — back to design');
      setRejectOpen(false);
      refresh();
    } catch (err) {
      toast.error(err?.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 lg:p-5 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Truck size={20} className="text-[var(--primary)]" />
          <h2 className="text-base font-bold text-[var(--text-primary)]">Design → Execution Handover</h2>
          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${badge.cls}`}>
            {badge.label}
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <Fact label="Drawings" value={`${handover.drawings.filter((d) => d.walked).length}/${handover.drawings.length} walked`} />
          <Fact label="Punch items" value={`${handover.punchList.filter((p) => p.resolvedAt).length}/${handover.punchList.length} resolved`} />
          <Fact label="Design lead signed" value={handover.designLeadSignedAt ? fmt(handover.designLeadSignedAt) : '—'} />
          <Fact label="Supervisor accepted" value={handover.supervisorAcceptedAt ? fmt(handover.supervisorAcceptedAt) : handover.supervisorRejectedAt ? `Rejected ${fmt(handover.supervisorRejectedAt)}` : '—'} />
        </div>

        {handover.status === 'rejected' && handover.supervisorRejectionReason && (
          <div className="bg-[var(--error)]/8 border border-[var(--error)]/20 rounded-lg p-3 text-xs text-[var(--error)]">
            <p className="font-bold mb-0.5">Supervisor rejected</p>
            <p>{handover.supervisorRejectionReason}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border)]">
          {canSign && (
            <Button onClick={() => setSignOpen(true)} disabled={submitting}>
              <PenLine size={13} className="mr-1.5" /> Sign as Design Lead
            </Button>
          )}
          {canAccept && (
            <Button onClick={() => setAcceptOpen(true)} disabled={submitting} variant="primary">
              <ThumbsUp size={13} className="mr-1.5" /> Supervisor Accept
            </Button>
          )}
          {canReject && (
            <Button onClick={() => setRejectOpen(true)} disabled={submitting} variant="outline">
              <ThumbsDown size={13} className="mr-1.5" /> Reject
            </Button>
          )}
          {handover.status === 'rejected' && hasPermission('projects.update') && (
            <Button onClick={async () => { await pmsService.requestHandover(projectId, {}); refresh(); }} variant="primary">
              <Truck size={13} className="mr-1.5" /> Re-request
            </Button>
          )}
        </div>
      </div>

      {/* Walkthrough + Punch */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DrawingWalkthrough handover={handover} onChanged={refresh} />
        <PunchList handover={handover} onChanged={refresh} />
      </div>

      {/* Modals */}
      <ActionModal
        title="Sign as Design Lead"
        label="Sign"
        isOpen={signOpen}
        onClose={() => setSignOpen(false)}
        onSubmit={doSign}
        submitting={submitting}
      />
      <ActionModal
        title="Supervisor Accept Handover"
        label="Accept"
        isOpen={acceptOpen}
        onClose={() => setAcceptOpen(false)}
        onSubmit={doAccept}
        submitting={submitting}
      />
      <ActionModal
        title="Reject Handover"
        label="Reject"
        isOpen={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onSubmit={doReject}
        requireReason
        submitting={submitting}
      />
    </div>
  );
};

const Fact = ({ label, value }) => (
  <div>
    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
    <p className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">{value}</p>
  </div>
);

export default HandoverTab;
