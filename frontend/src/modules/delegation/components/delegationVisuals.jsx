// Shared visual components for the Delegation module — keeps the list,
// dashboard and detail screens visually consistent (avatars, progress
// indicators, due-date pills, skeletons). Pure helpers/constants live in
// ./delegationFormat. All colors come from theme.css tokens (Modern Luxe).

import { Calendar } from 'lucide-react';
import { isOverdue, fmtDate } from './delegationFormat';

/* Gold-gradient initials avatar. Unassigned → muted dashed ring. */
export const InitialsAvatar = ({ name, size = 28, className = '' }) => {
  const initials =
    (name || '')
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';

  if (!name) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full border border-dashed border-[var(--divider)] text-[var(--text-muted)] shrink-0 ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.42 }}
      >
        ?
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-bold text-black shrink-0 shadow-sm ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: 'linear-gradient(135deg, var(--primary), var(--primary-active))',
      }}
    >
      {initials}
    </span>
  );
};

/* User shown as avatar + name (used in cards/meta rows). */
export const UserChip = ({ name, size = 22, className = '' }) => (
  <span className={`inline-flex items-center gap-1.5 min-w-0 ${className}`}>
    <InitialsAvatar name={name} size={size} />
    <span className="truncate text-[var(--text-secondary)] font-semibold">
      {name || 'Unassigned'}
    </span>
  </span>
);

/* Department chip with its own color dot. */
export const DeptChip = ({ name, color }) => (
  <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)] font-semibold">
    <span
      className="w-2 h-2 rounded-full shrink-0"
      style={{ background: color || 'var(--primary)' }}
    />
    {name}
  </span>
);

/* Due-date pill — turns red + bold when overdue. */
export const DueDatePill = ({ delegation }) => {
  const over = isOverdue(delegation);
  if (!delegation?.dueDate) {
    return <span className="text-xs text-[var(--text-muted)]">No due date</span>;
  }
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap px-2 py-1 rounded-lg ${
        over ? 'text-[var(--error)]' : 'text-[var(--text-muted)]'
      }`}
      style={
        over
          ? { background: 'color-mix(in srgb, var(--error) 10%, transparent)' }
          : undefined
      }
    >
      <Calendar size={12} />
      {fmtDate(delegation.dueDate)}
    </span>
  );
};

/* Thin animated progress bar. */
export const ProgressBar = ({ value = 0, color = 'var(--primary)', className = '' }) => {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className={`h-1.5 rounded-full overflow-hidden bg-[var(--bg)] border border-[var(--border)] ${className}`}
    >
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
};

/* SVG progress ring with centered % — used in the detail hero. */
export const ProgressRing = ({ value = 0, size = 68, stroke = 7, color = 'var(--primary)' }) => {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset .7s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center leading-none">
        <span className="text-sm font-extrabold text-[var(--text-primary)] tabular-nums">{pct}%</span>
      </div>
    </div>
  );
};

/* Loading skeleton row for the list. */
export const SkeletonCard = () => (
  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 animate-pulse">
    <div className="flex items-center gap-3">
      <div className="w-1.5 h-10 rounded-full bg-[var(--bg)]" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-1/3 rounded bg-[var(--bg)]" />
        <div className="h-2.5 w-1/2 rounded bg-[var(--bg)]" />
      </div>
      <div className="h-6 w-16 rounded-lg bg-[var(--bg)]" />
      <div className="h-6 w-20 rounded-lg bg-[var(--bg)]" />
    </div>
  </div>
);
