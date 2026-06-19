import { Clock, Lock, AlertTriangle, Hand } from 'lucide-react';

/**
 * ScheduleBadges — presentational status chips for the master-sheet scheduling
 * columns. No API calls, no business rules. Colours reuse the existing theme
 * tokens and follow the TaskStatusBadge class convention.
 */

const BADGE_BASE =
  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap';

// scheduleStatus keys come straight from scheduleEngine.getScheduleStatus.
const SCHEDULE_STATUS = {
  on_track:  { label: 'On Track',  cls: 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/30' },
  due_today: { label: 'Due Today', cls: 'bg-[var(--warning)]/15 text-[var(--warning)] border-[var(--warning)]/30' },
  overdue:   { label: 'Overdue',   cls: 'bg-[var(--error)]/15 text-[var(--error)] border-[var(--error)]/30' },
  shifted:   { label: 'Shifted',   cls: 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border-[var(--accent-blue)]/30' },
  blocked:   { label: 'Blocked',   cls: 'bg-[var(--error)]/10 text-[var(--error)] border-[var(--error)]/20' },
  completed: { label: 'Completed', cls: 'bg-[var(--success)]/15 text-[var(--success)] border-[var(--success)]/30' },
};

export const ScheduleStatusBadge = ({ status }) => {
  const s = SCHEDULE_STATUS[status] || SCHEDULE_STATUS.on_track;
  return <span className={`${BADGE_BASE} ${s.cls}`}>{s.label}</span>;
};

/**
 * AutoShiftedIndicator — a clickable clock + shift count. Opens the shift
 * history when clicked. Renders a muted dash when never shifted.
 */
export const AutoShiftedIndicator = ({ shiftCount = 0, onClick, title }) => {
  if (!shiftCount) {
    return <span className="text-[11px] text-[var(--text-muted)]">—</span>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={title || `Shifted ${shiftCount} time(s) — view history`}
      className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--accent-blue)] hover:underline"
    >
      <Clock size={12} /> ×{shiftCount}
    </button>
  );
};

export const LockBadge = ({ locked, onClick, disabled, title }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title || (locked ? 'Schedule locked — click to unlock' : 'Lock schedule (no auto-shift)')}
    className={`p-1 rounded transition-colors ${
      locked
        ? 'text-[var(--warning)] hover:bg-[var(--warning)]/10'
        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)]'
    } disabled:opacity-40 disabled:cursor-not-allowed`}
  >
    <Lock size={13} className={locked ? '' : 'opacity-60'} />
  </button>
);

export const ManualOverrideBadge = ({ reason }) => (
  <span
    title={reason ? `Manually overridden: ${reason}` : 'Manually overridden'}
    className="inline-flex items-center text-[var(--warning)]"
  >
    <Hand size={12} />
  </span>
);

export const BlockedBadge = () => (
  <span className={`${BADGE_BASE} bg-[var(--error)]/10 text-[var(--error)] border-[var(--error)]/20`}>
    <AlertTriangle size={11} /> Blocked
  </span>
);

export default ScheduleStatusBadge;
