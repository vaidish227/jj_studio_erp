import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

// KpiTile — compact metric tile with a tinted surface, a faint oversized
// watermark of its own icon, and an optional delta pill. Set `invertDelta` for
// metrics where "down is good" (e.g. Lost Rate) so the pill colors correctly.
const TONE_VAR = {
  primary: 'var(--primary)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  error:   'var(--error)',
  accent:  'var(--accent-blue)',
  teal:    'var(--accent-teal)',
};

const KpiTile = ({
  icon: Icon,
  label,
  value,
  suffix = '',
  delta,
  deltaSuffix = '',
  invertDelta = false,
  tone = 'primary',
  to,
}) => {
  const color = TONE_VAR[tone] || 'var(--text-muted)';

  const hasDelta = delta !== null && delta !== undefined && !Number.isNaN(delta) && delta !== 0;
  const up = (delta ?? 0) > 0;
  const good = invertDelta ? !up : up;
  const trendColor = good ? 'var(--success)' : 'var(--error)';
  const TrendIcon = up ? ArrowUpRight : ArrowDownRight;

  const inner = (
    <>
      {Icon && (
        <Icon
          size={72}
          className="absolute -right-3 -bottom-3 opacity-[0.06] pointer-events-none"
          style={{ color }}
        />
      )}
      <div className="relative flex items-start justify-between gap-2">
        {Icon && (
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
          >
            <Icon size={16} />
          </div>
        )}
        {hasDelta && (
          <div
            className="inline-flex items-center gap-0.5 text-[10px] font-black px-1.5 py-0.5 rounded-full"
            style={{ background: `color-mix(in srgb, ${trendColor} 14%, transparent)`, color: trendColor }}
          >
            <TrendIcon size={11} strokeWidth={3} />
            {Math.abs(delta)}{deltaSuffix}
          </div>
        )}
      </div>
      <p className="relative text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mt-3">
        {label}
      </p>
      <p className="relative text-2xl font-extrabold text-[var(--text-primary)] leading-tight mt-0.5 tabular-nums">
        {value}{suffix}
      </p>
    </>
  );

  const classes = `relative overflow-hidden block text-left w-full rounded-2xl p-4 border transition-all duration-200 ${
    to ? 'hover:-translate-y-0.5 hover:shadow-md cursor-pointer active:scale-[0.98]' : ''
  }`;
  const style = {
    background: `color-mix(in srgb, ${color} 5%, var(--surface))`,
    borderColor: `color-mix(in srgb, ${color} 22%, transparent)`,
  };

  return to
    ? <Link to={to} className={classes} style={style}>{inner}</Link>
    : <div className={classes} style={style}>{inner}</div>;
};

export default KpiTile;
