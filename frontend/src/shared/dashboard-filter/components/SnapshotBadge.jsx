import { Info, History } from 'lucide-react';

/**
 * Tiny pill marking widgets that intentionally DON'T respond to a dashboard
 * date filter. The native `title` (+ aria-label) gives an accessible tooltip.
 *
 *   live     → real-time operational state ("now")
 *   snapshot → cumulative / all-time figure
 *   fixed    → trend with its own rolling window
 */
const VARIANTS = {
  live: {
    label: 'Live',
    tip: 'Shows current real-time status — not affected by the selected date range.',
    color: 'var(--success)',
    pulse: true,
  },
  snapshot: {
    label: 'Current',
    tip: 'Cumulative all-time figure — not affected by the selected date range.',
    color: 'var(--text-muted)',
    Icon: Info,
  },
  fixed: {
    label: 'Rolling 12 wks',
    tip: 'Rolling last 12 weeks — not affected by the selected date range.',
    color: 'var(--text-muted)',
    Icon: History,
  },
};

// `label` overrides the variant's default text (e.g. fixed → "Next 7 Days").
// Behavior is unchanged when `label` is omitted.
const SnapshotBadge = ({ variant = 'snapshot', label, className = '' }) => {
  const v = VARIANTS[variant] || VARIANTS.snapshot;
  const Icon = v.Icon;
  return (
    <span
      title={v.tip}
      role="note"
      aria-label={v.tip}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide cursor-help select-none ${className}`}
      style={{ color: v.color, background: `color-mix(in srgb, ${v.color} 12%, transparent)` }}
    >
      {v.pulse ? (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: v.color }} />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: v.color }} />
        </span>
      ) : (
        Icon && <Icon size={10} />
      )}
      {label || v.label}
    </span>
  );
};

export default SnapshotBadge;
