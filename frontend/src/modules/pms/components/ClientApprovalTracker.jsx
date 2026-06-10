import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, MinusCircle, Lock, AlertTriangle, Users, Send } from 'lucide-react';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';
import SendApprovalRequestModal from './SendApprovalRequestModal';

const APPROVAL_TYPES = [
  { key: 'furniture_layout',    label: 'Furniture Layout' },
  { key: 'ac',                  label: 'AC Layout Approval' },
  { key: 'automation',          label: 'Automation Design Approval' },
  { key: 'kitchen',             label: 'Kitchen Design Approval' },
  { key: 'bathroom_material',   label: 'Bathroom Material Selection', hybrid: true },
  { key: 'cp_fittings',         label: 'CP Fittings Approval' },
  { key: 'wall_floor_material', label: 'Wall & Floor Material' },
];

// Mapping of clientApprovals[].type → ApprovalGate.listensTo to look up gate state
const TYPE_TO_GATE_LISTENS = {
  furniture_layout:    'furniture_layout',
  ac:                  'ac',
  automation:          'automation',
  kitchen:             'kitchen',
  bathroom_material:   'bathroom_material',
  cp_fittings:         'cp_fittings',
  wall_floor_material: 'wall_floor_material',
};

const STATUS_CFG = {
  pending:        { Icon: Lock,         color: 'text-[var(--warning)]',    bg: 'bg-[var(--warning)]/12',  label: 'Pending' },
  obtained:       { Icon: CheckCircle2, color: 'text-[var(--success)]',    bg: 'bg-[var(--success)]/12',  label: 'Obtained' },
  not_applicable: { Icon: XCircle,      color: 'text-[var(--text-muted)]', bg: 'bg-[var(--border)]',      label: 'N/A' },
};

const STATUS_CYCLE = ['pending', 'obtained', 'not_applicable'];

const ClientApprovalTracker = ({ project, projectId, approvals = [], onUpdated, readOnly = false, layout = 'list' }) => {
  const toast = useToast();
  const [items, setItems] = useState(() =>
    APPROVAL_TYPES.map(({ key }) => {
      const found = approvals.find((a) => a.type === key);
      return { type: key, status: found?.status || 'pending' };
    })
  );
  const [saving, setSaving] = useState(null);
  const [sendModalType, setSendModalType] = useState(null);

  // Phase 2 — Hybrid approval state (Principal Designer side for bathroom_material)
  const [gatesByType, setGatesByType] = useState({});
  useEffect(() => {
    if (!projectId) return;
    pmsService.getProjectGates(projectId)
      .then((res) => {
        const map = {};
        for (const g of (res.gates || [])) {
          if (g.listensTo) map[g.listensTo] = g;
        }
        setGatesByType(map);
      })
      .catch(() => setGatesByType({}));
  }, [projectId, onUpdated]);

  const obtained = items.filter((i) => i.status === 'obtained').length;
  const pending  = items.filter((i) => i.status === 'pending').length;
  const isAwaiting = pending > 0;

  const setStatus = async (idx, next) => {
    if (readOnly) return;
    const current = items[idx].status;
    if (current === next) return;
    setItems((prev) => {
      const u = [...prev];
      u[idx] = { ...u[idx], status: next };
      return u;
    });
    setSaving(idx);
    try {
      await pmsService.updateClientApproval(projectId, { type: items[idx].type, status: next });
      onUpdated?.();
    } catch {
      setItems((prev) => {
        const r = [...prev];
        r[idx] = { ...r[idx], status: current };
        return r;
      });
      toast.error('Failed to update approval');
    } finally {
      setSaving(null);
    }
  };

  const cycle = (idx) => {
    const current = items[idx].status;
    const next    = STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length];
    setStatus(idx, next);
  };

  const markObtained = (idx) => setStatus(idx, 'obtained');

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
      {/* Header — dynamic. Reads "Awaiting client approval" while there are
          pending items, then flips to "Client Approvals" once everything is
          obtained/N/A. Same visual language as the old WhatsBlockingWidget. */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {isAwaiting ? (
            <AlertTriangle size={16} className="text-[var(--warning)] shrink-0" />
          ) : (
            <CheckCircle2 size={16} className="text-[var(--success)] shrink-0" />
          )}
          <h3 className="text-sm font-bold text-[var(--text-primary)]">
            {isAwaiting ? 'Awaiting client approval' : 'Client Approvals'}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {pending > 0 && (
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-[var(--warning)]/15 text-[var(--warning)]">
              {pending} pending
            </span>
          )}
          <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
            obtained === APPROVAL_TYPES.length
              ? 'bg-[var(--success)]/10 text-[var(--success)]'
              : 'bg-[var(--border)] text-[var(--text-muted)]'
          }`}>
            {obtained}/{APPROVAL_TYPES.length} obtained
          </span>
        </div>
      </div>

      <div className={layout === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-2' : 'space-y-2'}>
        {items.map((item, idx) => {
          const cfg = STATUS_CFG[item.status];
          const { Icon } = cfg;
          const meta = APPROVAL_TYPES[idx];
          const gate = gatesByType[TYPE_TO_GATE_LISTENS[item.type] || item.type];
          const isHybrid = meta.hybrid || gate?.approverType === 'principal_and_client';
          const pdApproved = gate?.pdApproval?.status === 'approved';
          const clientObtained = item.status === 'obtained';
          const isPending = item.status === 'pending';
          const isObtained = item.status === 'obtained';
          const isNA = item.status === 'not_applicable';

          // Outer card styling: pending = amber tint (action-prompting),
          // obtained = green tint (done), N/A = muted.
          const rowBase = isPending
            ? 'bg-[var(--warning)]/8 border-[var(--warning)]/25'
            : isObtained
              ? 'bg-[var(--success)]/8 border-[var(--success)]/25'
              : 'bg-[var(--bg)] border-[var(--border)]';

          return (
            <div key={item.type} className={`rounded-xl border overflow-hidden ${rowBase}`}>
              <div className="flex items-center gap-3 p-3">
                <Icon size={16} className={`${cfg.color} shrink-0`} />

                {/* Click-to-cycle stays as a power-user fallback so existing
                    muscle memory ("click to cycle Pending → Obtained → N/A")
                    still works. New users get the explicit Mark Approved
                    button on the right. */}
                <button
                  type="button"
                  disabled={saving !== null || readOnly}
                  onClick={() => cycle(idx)}
                  title={readOnly
                    ? 'View-only — only PM can update client approvals'
                    : 'Click to cycle: Pending → Obtained → N/A'}
                  className={`flex-1 min-w-0 text-left text-sm font-semibold text-[var(--text-primary)] truncate
                              ${readOnly ? 'cursor-default' :
                                saving !== null ? 'opacity-60 cursor-not-allowed' :
                                'cursor-pointer'}`}
                >
                  {meta.label}
                </button>

                {/* Terminal-state badge (right side) for obtained / N/A only.
                    For pending items the explicit action button replaces the
                    badge so the row is a clear call to action. */}
                {!isPending && (
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                )}

                {/* Action cluster for pending rows. Soft primary-gold tint
                    matches the JJ Studio brand and stays light enough not to
                    overpower the amber row background. */}
                {!readOnly && isPending && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => markObtained(idx)}
                      disabled={saving === idx}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold
                                 bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/30
                                 hover:bg-[var(--primary)]/25 transition-colors
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircle2 size={12} /> Mark Approved
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSendModalType(item.type); }}
                      className="p-1.5 rounded-lg text-[var(--text-muted)]
                                 hover:text-[var(--primary)] hover:bg-[var(--primary)]/10
                                 transition-colors"
                      title="Send approval request to client (WhatsApp + Mail)"
                    >
                      <Send size={13} />
                    </button>
                  </div>
                )}
              </div>

              {isHybrid && (
                <div className="flex items-center flex-wrap gap-1.5 px-3 py-2 border-t border-current/10 bg-black/[0.02]">
                  <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                    <Users size={10} /> Hybrid:
                  </span>
                  <ApprovalChip label="PD" ok={pdApproved} />
                  <ApprovalChip label="Client" ok={clientObtained} />
                  {gate?.status === 'closed' && (
                    <span className="text-[10px] font-bold text-[var(--success)] uppercase">Sign-off complete</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-[var(--text-muted)] mt-3 px-1">
        {readOnly
          ? 'View-only — only the PM can update client approval status.'
          : 'Click "Mark Approved" once the client confirms. Click the row label to cycle through Pending → Obtained → N/A. Hybrid rows need both PD and Client.'}
      </p>

      {/* Phase 3a — Send approval request modal */}
      <SendApprovalRequestModal
        project={project}
        approvalType={sendModalType}
        isOpen={!!sendModalType}
        onClose={() => setSendModalType(null)}
      />
    </div>
  );
};

const ApprovalChip = ({ label, ok }) => (
  <span
    className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded
      ${ok
        ? 'bg-[var(--success)]/12 text-[var(--success)] border border-[var(--success)]/30'
        : 'bg-[var(--warning)]/8 text-[var(--warning)] border border-[var(--warning)]/30'}
    `}
  >
    {ok ? <CheckCircle2 size={9} /> : <MinusCircle size={9} />} {label}
  </span>
);

export default ClientApprovalTracker;
