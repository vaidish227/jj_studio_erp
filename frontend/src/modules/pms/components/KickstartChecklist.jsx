import React, { useState } from 'react';
import { CheckCircle2, Lock, AlertTriangle, Loader2 } from 'lucide-react';
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
  const pending   = KICKSTART_ITEMS.length - completed;
  const allDone   = completed === KICKSTART_ITEMS.length;
  const isAwaiting = pending > 0;

  const setDone = async (key, next) => {
    if (data[key] === next) return;
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

  const toggle    = (key) => setDone(key, !data[key]);
  const markDone  = (key) => setDone(key, true);

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
      {/* Header — mirrors ClientApprovalTracker so both cards on Overview read
          as a matching pair: warning chrome while there's work outstanding,
          success chrome once complete. */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {isAwaiting ? (
            <AlertTriangle size={16} className="text-[var(--warning)] shrink-0" />
          ) : (
            <CheckCircle2 size={16} className="text-[var(--success)] shrink-0" />
          )}
          <h3 className="text-sm font-bold text-[var(--text-primary)]">
            {isAwaiting ? 'Kickoff in progress' : 'Project Kickstart'}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {pending > 0 && (
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-[var(--warning)]/15 text-[var(--warning)]">
              {pending} pending
            </span>
          )}
          <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
            allDone
              ? 'bg-[var(--success)]/10 text-[var(--success)]'
              : 'bg-[var(--border)] text-[var(--text-muted)]'
          }`}>
            {completed}/{KICKSTART_ITEMS.length}
          </span>
        </div>
      </div>

      <div className="h-1 rounded-full bg-[var(--border)] mb-3 overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--primary)] transition-all duration-300"
          style={{ width: `${Math.round((completed / KICKSTART_ITEMS.length) * 100)}%` }}
        />
      </div>

      <div className="space-y-2">
        {KICKSTART_ITEMS.map(({ key, label }) => {
          const isDone   = !!data[key];
          const isSaving = saving === key;

          const rowBase = isDone
            ? 'bg-[var(--success)]/8 border-[var(--success)]/25'
            : 'bg-[var(--warning)]/8 border-[var(--warning)]/25';

          return (
            <div
              key={key}
              className={`flex items-center gap-3 p-3 rounded-xl border ${rowBase}`}
            >
              {isSaving ? (
                <Loader2 size={16} className="text-[var(--primary)] animate-spin shrink-0" />
              ) : isDone ? (
                <CheckCircle2 size={16} className="text-[var(--success)] shrink-0" />
              ) : (
                <Lock size={16} className="text-[var(--warning)] shrink-0" />
              )}

              {/* Click-the-label still toggles state (kept for muscle memory).
                  Done items strike-through to match the previous look. */}
              <button
                type="button"
                disabled={saving !== null}
                onClick={() => toggle(key)}
                title={isDone ? 'Click to mark not done' : 'Click to mark done'}
                className={`flex-1 min-w-0 text-left text-sm font-semibold truncate
                            ${saving !== null ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                            ${isDone ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}
              >
                {label}
              </button>

              {/* Terminal-state badge for done; explicit action button for
                  pending — same pattern as Client Approvals. */}
              {isDone ? (
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--success)]/12 text-[var(--success)]">
                  Done
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => markDone(key)}
                  disabled={isSaving}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold
                             bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/30
                             hover:bg-[var(--primary)]/25 transition-colors shrink-0
                             disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 size={12} /> Mark Done
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default KickstartChecklist;
