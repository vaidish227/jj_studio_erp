import React, { useState } from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';

const KICKSTART_ITEMS = [
  { key: 'mainGroupCreated',        label: 'Main WhatsApp Group Created' },
  { key: 'drawingGroupCreated',     label: 'Drawing Group Created' },
  { key: 'supervisionGroupCreated', label: 'Supervision Group Created' },
  { key: 'paymentGroupCreated',     label: 'Payment Group Created' },
  { key: 'detailFormSentToClient',  label: 'Detail Form Sent to Client' },
  { key: 'labourQuotationSent',     label: 'Labour Quotation Sent' },
];

const KickstartChecklist = ({ projectId, kickstartData = {}, onUpdated }) => {
  const toast = useToast();
  const [data, setData]     = useState(kickstartData);
  const [saving, setSaving] = useState(null);

  const completed = KICKSTART_ITEMS.filter((i) => data[i.key]).length;
  const allDone   = completed === KICKSTART_ITEMS.length;

  const toggle = async (key) => {
    const next = !data[key];
    setData((prev) => ({ ...prev, [key]: next }));
    setSaving(key);
    try {
      await pmsService.updateKickstart(projectId, { [key]: next });
      onUpdated?.();
    } catch {
      setData((prev) => ({ ...prev, [key]: !next }));
      toast.error('Failed to update kickstart item');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Project Kickstart</h3>
        <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
          allDone
            ? 'bg-[var(--success)]/10 text-[var(--success)]'
            : 'bg-[var(--border)] text-[var(--text-muted)]'
        }`}>
          {completed}/{KICKSTART_ITEMS.length}
        </span>
      </div>

      <div className="h-1 rounded-full bg-[var(--border)] mb-3 overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--primary)] transition-all duration-300"
          style={{ width: `${Math.round((completed / KICKSTART_ITEMS.length) * 100)}%` }}
        />
      </div>

      <div className="space-y-1">
        {KICKSTART_ITEMS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            disabled={saving !== null}
            onClick={() => toggle(key)}
            className={`w-full flex items-center gap-3 text-left py-2 px-1 rounded-lg
                        hover:bg-[var(--bg)] transition-colors group
                        ${saving !== null ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {saving === key
              ? <Loader2 size={16} className="text-[var(--primary)] animate-spin shrink-0" />
              : data[key]
                ? <CheckCircle2 size={16} className="text-[var(--success)] shrink-0" />
                : <Circle size={16} className="text-[var(--border)] shrink-0 group-hover:text-[var(--primary)] transition-colors" />
            }
            <span className={`text-sm ${data[key] ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default KickstartChecklist;
