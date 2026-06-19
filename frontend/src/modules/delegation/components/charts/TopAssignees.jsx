import { InitialsAvatar } from '../delegationVisuals';

// TopAssignees — who is carrying the open workload. Avatar + name + a mini bar
// scaled to the busiest person, so overload is obvious at a glance.
const TopAssignees = ({ assignees = [] }) => {
  if (!assignees.length) {
    return <div className="h-full flex items-center justify-center text-sm text-[var(--text-muted)]">No open work assigned.</div>;
  }

  const max = Math.max(1, ...assignees.map((a) => a.count));

  return (
    <ul className="space-y-3">
      {assignees.map((a) => (
        <li key={String(a.userId) || 'unassigned'} className="flex items-center gap-3">
          <InitialsAvatar name={a.name === 'Unassigned' ? '' : a.name} size={28} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--text-primary)] truncate">{a.name}</span>
              <span className="text-xs font-extrabold tabular-nums text-[var(--text-primary)]">{a.count}</span>
            </div>
            <div className="mt-1 h-2 rounded-full overflow-hidden bg-[var(--bg)] border border-[var(--border)]">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{ width: `${(a.count / max) * 100}%`, background: 'var(--primary)' }}
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
};

export default TopAssignees;
