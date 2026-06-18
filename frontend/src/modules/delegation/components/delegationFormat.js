// Pure (non-component) helpers + constants for the Delegation module.
// Kept separate from delegationVisuals.jsx so that file can export only
// components (React Fast Refresh requirement). All colors are theme tokens.

/* Priority → accent color used for the card left-stripe + dots. Escalates
   cool → warm so urgency reads at a glance even before the chip is parsed. */
export const PRIORITY_ACCENT = {
  low: 'var(--text-muted)',
  medium: 'var(--accent-blue)',
  high: 'var(--warning)',
  urgent: 'var(--error)',
};

export const isOverdue = (d) =>
  !!d?.dueDate &&
  new Date(d.dueDate) < new Date() &&
  !['completed', 'cancelled'].includes(d.status);

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString() : '—');

/* "18 Jun 2026" */
export const fmtDateShort = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/* "17 Jun 2026, 03:45 PM" */
export const fmtDateTimeShort = (d) =>
  d
    ? new Date(d).toLocaleString(undefined, {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '—';

/* Due-date intelligence for the detail view:
   tone = 'overdue' (red) | 'soon' (amber, ≤2 days) | 'normal'
   relative = "Today" / "Tomorrow" / "in 4 days" / "2 days ago". */
export const dueDateInfo = (dueDate, status) => {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const day = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((day(due) - day(new Date())) / 86400000);
  const done = ['completed', 'cancelled'].includes(status);

  let relative;
  if (diff === 0) relative = 'Today';
  else if (diff === 1) relative = 'Tomorrow';
  else if (diff === -1) relative = 'Yesterday';
  else if (diff > 1) relative = `in ${diff} days`;
  else relative = `${Math.abs(diff)} days ago`;

  let tone = 'normal';
  if (!done) {
    if (diff < 0) tone = 'overdue';
    else if (diff <= 2) tone = 'soon';
  }
  return { label: fmtDateShort(dueDate), relative, tone, diff };
};

/* Compact "2h ago" relative time for timelines/activity. */
export const relativeTime = (d) => {
  if (!d) return '';
  const date = new Date(d);
  const s = Math.round((Date.now() - date.getTime()) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};
