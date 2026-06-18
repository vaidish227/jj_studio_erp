import { STATUS_META, PRIORITY_META } from '../constants/delegationStatus';

// Tone → Tailwind classes, mirroring shared/StatusBadge + TaskStatusBadge tones.
const TONE = {
  muted: 'bg-[var(--bg)] text-[var(--text-muted)] border-[var(--border)]',
  gold:  'bg-[var(--primary)]/10 text-[var(--primary-active)] border-[var(--primary)]/25',
  blue:  'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border-[var(--accent-blue)]/20',
  warn:  'bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/20',
  ok:    'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20',
  err:   'bg-[var(--error)]/10 text-[var(--error)] border-[var(--error)]/20',
};

// Solid dot color per tone (uses currentColor of the badge, so a single class works).
const CLS =
  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border';

export const DelegationStatusBadge = ({ status, className = '' }) => {
  const m = STATUS_META[status] || { label: status || '—', tone: 'muted' };
  return (
    <span className={`${CLS} ${TONE[m.tone]} ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {m.label}
    </span>
  );
};

export const PriorityChip = ({ priority, className = '' }) => {
  const m = PRIORITY_META[priority] || { label: priority || '—', tone: 'muted' };
  return <span className={`${CLS} ${TONE[m.tone]} ${className}`}>{m.label}</span>;
};

export default DelegationStatusBadge;
