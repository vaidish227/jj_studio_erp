import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, MinusCircle, Users, Send } from 'lucide-react';
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
  pending:        { Icon: MinusCircle,  color: 'text-[var(--text-muted)]', bg: 'bg-[var(--border)]',         label: 'Pending' },
  obtained:       { Icon: CheckCircle2, color: 'text-[var(--success)]',    bg: 'bg-[var(--success)]/10',     label: 'Obtained' },
  not_applicable: { Icon: XCircle,      color: 'text-[var(--text-muted)]', bg: 'bg-[var(--border)]',         label: 'N/A' },
};

const STATUS_CYCLE = ['pending', 'obtained', 'not_applicable'];

const ClientApprovalTracker = ({ project, projectId, approvals = [], onUpdated, readOnly = false }) => {
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

  const cycle = async (idx) => {
    if (readOnly) return;
    const current = items[idx].status;
    const next    = STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length];

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

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Client Approvals</h3>
        <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
          obtained === APPROVAL_TYPES.length
            ? 'bg-[var(--success)]/10 text-[var(--success)]'
            : 'bg-[var(--border)] text-[var(--text-muted)]'
        }`}>
          {obtained}/{APPROVAL_TYPES.length} obtained
        </span>
      </div>

      <div className="space-y-1">
        {items.map((item, idx) => {
          const cfg = STATUS_CFG[item.status];
          const { Icon } = cfg;
          const meta = APPROVAL_TYPES[idx];
          const gate = gatesByType[TYPE_TO_GATE_LISTENS[item.type] || item.type];
          const isHybrid = meta.hybrid || gate?.approverType === 'principal_and_client';
          const pdApproved = gate?.pdApproval?.status === 'approved';
          const clientObtained = item.status === 'obtained';
          return (
            <div key={item.type}>
              <div className="flex items-center gap-1 group">
                <button
                  type="button"
                  disabled={saving !== null || readOnly}
                  onClick={() => cycle(idx)}
                  title={readOnly
                    ? 'View-only — only PM can update client approvals'
                    : 'Click to cycle: Pending → Obtained → N/A'}
                  className={`flex-1 flex items-center gap-3 text-left py-2 px-2 rounded-lg transition-colors
                              ${readOnly ? 'cursor-default' :
                                saving !== null ? 'opacity-60 cursor-not-allowed' :
                                'cursor-pointer hover:bg-[var(--bg)]'}`}
                >
                  <Icon size={16} className={`${cfg.color} shrink-0`} />
                  <span className="flex-1 text-sm text-[var(--text-primary)]">
                    {meta.label}
                  </span>
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </button>
                {!readOnly && item.status !== 'obtained' && item.status !== 'not_applicable' && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSendModalType(item.type); }}
                    className="shrink-0 p-1.5 rounded-lg text-[var(--text-muted)]
                               hover:text-[var(--primary)] hover:bg-[var(--primary)]/10
                               transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Send approval request to client (WhatsApp + Mail)"
                  >
                    <Send size={13} />
                  </button>
                )}
              </div>
              {isHybrid && (
                <div className="flex items-center gap-1.5 px-9 pb-1.5">
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
      <p className="text-[10px] text-[var(--text-muted)] mt-2 px-1">
        {readOnly
          ? 'View-only — only the PM can update client approval status.'
          : 'Click any row to cycle status. Hover to send via WhatsApp/Mail. Hybrid rows need both PD and Client.'}
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
