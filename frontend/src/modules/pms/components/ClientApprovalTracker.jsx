import React, { useState } from 'react';
import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';

const APPROVAL_TYPES = [
  { key: 'ac',                  label: 'AC Layout Approval' },
  { key: 'automation',          label: 'Automation Design Approval' },
  { key: 'kitchen',             label: 'Kitchen Design Approval' },
  { key: 'bathroom_material',   label: 'Bathroom Material Selection' },
  { key: 'cp_fittings',         label: 'CP Fittings Approval' },
  { key: 'wall_floor_material', label: 'Wall & Floor Material' },
];

const STATUS_CFG = {
  pending:        { Icon: MinusCircle,  color: 'text-[var(--text-muted)]', bg: 'bg-[var(--border)]',         label: 'Pending' },
  obtained:       { Icon: CheckCircle2, color: 'text-[var(--success)]',    bg: 'bg-[var(--success)]/10',     label: 'Obtained' },
  not_applicable: { Icon: XCircle,      color: 'text-[var(--text-muted)]', bg: 'bg-[var(--border)]',         label: 'N/A' },
};

const STATUS_CYCLE = ['pending', 'obtained', 'not_applicable'];

const ClientApprovalTracker = ({ projectId, approvals = [], onUpdated }) => {
  const toast = useToast();
  const [items, setItems] = useState(() =>
    APPROVAL_TYPES.map(({ key }) => {
      const found = approvals.find((a) => a.type === key);
      return { type: key, status: found?.status || 'pending' };
    })
  );
  const [saving, setSaving] = useState(null);

  const obtained = items.filter((i) => i.status === 'obtained').length;

  const cycle = async (idx) => {
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
          return (
            <button
              key={item.type}
              type="button"
              disabled={saving !== null}
              onClick={() => cycle(idx)}
              title="Click to cycle: Pending → Obtained → N/A"
              className={`w-full flex items-center gap-3 text-left py-2 px-2 rounded-lg
                          hover:bg-[var(--bg)] transition-colors
                          ${saving !== null ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <Icon size={16} className={`${cfg.color} shrink-0`} />
              <span className="flex-1 text-sm text-[var(--text-primary)]">
                {APPROVAL_TYPES[idx].label}
              </span>
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                {cfg.label}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-[var(--text-muted)] mt-2 px-1">Click any row to cycle status</p>
    </div>
  );
};

export default ClientApprovalTracker;
