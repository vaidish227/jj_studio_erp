import { resolveVar } from './chartTheme';

// AgingBuckets — how long open work has been sitting (by createdAt). The ramp
// goes calm → hot so a fat "15+ days" bar reads as a backlog warning instantly.
const BUCKET_COLOR = {
  '0-2d':  'var(--success)',
  '3-7d':  'var(--accent-blue)',
  '8-14d': 'var(--warning)',
  '15d+':  'var(--error)',
};

const AgingBuckets = ({ aging = [] }) => {
  const total = aging.reduce((s, b) => s + b.count, 0);

  if (!total) {
    return <div className="h-full flex items-center justify-center text-sm text-[var(--text-muted)]">No open work to age.</div>;
  }

  const max = Math.max(1, ...aging.map((b) => b.count));

  return (
    <ul className="space-y-3">
      {aging.map((b) => {
        const color = resolveVar(BUCKET_COLOR[b.bucket] || 'var(--text-muted)');
        return (
          <li key={b.bucket} className="flex items-center gap-3 text-xs">
            <span className="w-16 shrink-0 font-semibold text-[var(--text-secondary)]">{b.label}</span>
            <div className="flex-1 h-2.5 rounded-full overflow-hidden bg-[var(--bg)] border border-[var(--border)]">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{ width: `${(b.count / max) * 100}%`, background: color }}
              />
            </div>
            <span className="w-6 text-right font-extrabold tabular-nums text-[var(--text-primary)]">{b.count}</span>
          </li>
        );
      })}
    </ul>
  );
};

export default AgingBuckets;
