import { PRIORITY_META } from '../../constants/delegationStatus';
import { PRIORITY_COLOR, resolveVar } from './chartTheme';

// PriorityBreakdown — open-work priority mix as a compact stacked share bar +
// labeled rows. A custom bar (vs a chart lib) reads cleaner for 4 fixed buckets
// and keeps the severity ramp obvious at a glance.
const PriorityBreakdown = ({ priorityMix = [] }) => {
  const total = priorityMix.reduce((s, p) => s + p.count, 0);

  if (!total) {
    return <div className="h-full flex items-center justify-center text-sm text-[var(--text-muted)]">No open work to prioritise.</div>;
  }

  return (
    <div className="space-y-4">
      {/* Stacked share bar */}
      <div className="flex h-3 w-full rounded-full overflow-hidden bg-[var(--bg)] border border-[var(--border)]">
        {priorityMix
          .filter((p) => p.count > 0)
          .map((p) => (
            <div
              key={p.priority}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ width: `${(p.count / total) * 100}%`, background: resolveVar(PRIORITY_COLOR[p.priority]) }}
              title={`${PRIORITY_META[p.priority]?.label}: ${p.count}`}
            />
          ))}
      </div>

      {/* Labeled rows */}
      <ul className="space-y-2.5">
        {priorityMix.map((p) => {
          const pct = total ? Math.round((p.count / total) * 100) : 0;
          const color = resolveVar(PRIORITY_COLOR[p.priority]);
          return (
            <li key={p.priority} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
              <span className="font-semibold text-[var(--text-primary)] flex-1">
                {PRIORITY_META[p.priority]?.label || p.priority}
              </span>
              <span className="font-extrabold tabular-nums text-[var(--text-primary)]">{p.count}</span>
              <span className="text-[var(--text-muted)] text-[10px] tabular-nums w-9 text-right">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default PriorityBreakdown;
