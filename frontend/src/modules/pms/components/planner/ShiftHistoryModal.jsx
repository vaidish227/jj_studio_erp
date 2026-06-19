import { useEffect, useState } from 'react';
import { Loader2, Clock, ArrowRight } from 'lucide-react';
import { ModalShell } from './sheetCells';
import { pmsService } from '../../../../shared/services/pmsService';

const fmt = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
  : '—';
const fmtDateTime = (d) => d
  ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '—';

// Engine source → chip styling/label.
const SOURCE_CHIP = {
  manual:        { label: 'Manual',       cls: 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border-[var(--accent-blue)]/30' },
  cron:          { label: 'Auto (Overdue)', cls: 'bg-[var(--warning)]/15 text-[var(--warning)] border-[var(--warning)]/30' },
  cascade:       { label: 'Cascade',      cls: 'bg-[var(--primary)]/15 text-[var(--primary)] border-[var(--primary)]/30' },
  parent:        { label: 'Parent',       cls: 'bg-[var(--primary)]/15 text-[var(--primary)] border-[var(--primary)]/30' },
  recalculate:   { label: 'Recalculated', cls: 'bg-[var(--text-muted)]/15 text-[var(--text-muted)] border-[var(--text-muted)]/30' },
};

/**
 * ShiftHistoryModal — newest-first audit trail of schedule shifts for a task.
 * Lazy-fetches on open to keep the master sheet payload light.
 *
 * Props: open, taskId, taskTitle, onClose
 */
const ShiftHistoryModal = ({ open, taskId, taskTitle, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !taskId) return;
    setLoading(true);
    setError(null);
    pmsService.getTaskShiftHistory(taskId)
      .then((res) => setHistory(Array.isArray(res?.history) ? res.history : []))
      .catch((err) => setError(err?.response?.data?.message || err?.message || 'Failed to load history'))
      .finally(() => setLoading(false));
  }, [open, taskId]);

  if (!open) return null;

  return (
    <ModalShell
      title="Shift History"
      subtitle={taskTitle}
      wide
      onClose={onClose}
      footer={(
        <button type="button" onClick={onClose}
          className="px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)]">
          Close
        </button>
      )}
    >
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] py-6 justify-center">
          <Loader2 size={14} className="animate-spin" /> Loading history…
        </div>
      ) : error ? (
        <p className="text-xs text-[var(--error)] py-4">{error}</p>
      ) : history.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)] italic text-center py-6">No shifts recorded for this task yet.</p>
      ) : (
        <ul className="space-y-2 max-h-[60vh] overflow-y-auto -mx-1 px-1">
          {history.map((h, idx) => {
            const chip = SOURCE_CHIP[h.source] || SOURCE_CHIP.manual;
            const sign = h.shiftDays > 0 ? '+' : '';
            return (
              <li key={idx} className="border border-[var(--border)] rounded-lg p-3 bg-[var(--bg)]/40">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                    <Clock size={12} className="text-[var(--accent-blue)]" />
                    {sign}{h.shiftDays} day{Math.abs(h.shiftDays) === 1 ? '' : 's'}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${chip.cls}`}>
                    {chip.label}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--text-secondary)] flex-wrap">
                  <span>{fmt(h.fromStart)} – {fmt(h.fromEnd)}</span>
                  <ArrowRight size={12} className="text-[var(--text-muted)]" />
                  <span className="font-semibold text-[var(--text-primary)]">{fmt(h.toStart)} – {fmt(h.toEnd)}</span>
                </div>
                {h.reason && <p className="mt-1.5 text-[11px] text-[var(--text-secondary)]">{h.reason}</p>}
                <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                  {h.shiftedBy?.name ? `By ${h.shiftedBy.name}` : 'By system'} · {fmtDateTime(h.shiftedAt)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </ModalShell>
  );
};

export default ShiftHistoryModal;
