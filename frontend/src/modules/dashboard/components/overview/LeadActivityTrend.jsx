import {
  ResponsiveContainer, ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import ChartTooltip from '../common/ChartTooltip';

// Resolve a CSS custom property to its computed value so recharts (which writes
// SVG presentation attributes) gets a real color, not an unresolved var().
const cssVar = (name, fallback = '#000') => {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
};

const fmtDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch {
    return iso;
  }
};

// Multi-series acquisition/conversion/loss trend. The three daily series share
// the same date axis (server fills gaps), so we zip them by index.
const LeadActivityTrend = ({ acquisition = [], converted = [], lost = [], height = 260 }) => {
  const primary = cssVar('--primary', '#C19A45');
  const success = cssVar('--success', '#3C8A4D');
  const error = cssVar('--error', '#C23B28');

  const data = acquisition.map((d, i) => ({
    label: fmtDate(d.date),
    leads: d.value || 0,
    converted: converted[i]?.value || 0,
    lost: lost[i]?.value || 0,
  }));

  const totals = {
    leads: data.reduce((s, d) => s + d.leads, 0),
    converted: data.reduce((s, d) => s + d.converted, 0),
    lost: data.reduce((s, d) => s + d.lost, 0),
  };

  const legend = [
    { name: 'New Leads', color: primary, total: totals.leads },
    { name: 'Converted', color: success, total: totals.converted },
    { name: 'Lost', color: error, total: totals.lost },
  ];

  if (!data.length) {
    return (
      <div className="flex items-center justify-center text-sm text-[var(--text-muted)]" style={{ height }}>
        No activity in selected range.
      </div>
    );
  }

  return (
    <div>
      {/* Compact legend doubling as range totals */}
      <div className="flex items-center gap-4 flex-wrap mb-3">
        {legend.map((l) => (
          <div key={l.name} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
            <span className="text-xs font-semibold text-[var(--text-secondary)]">{l.name}</span>
            <span className="text-xs font-extrabold tabular-nums" style={{ color: l.color }}>{l.total}</span>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="ovLeadsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={primary} stopOpacity={0.24} />
              <stop offset="100%" stopColor={primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={cssVar('--border', '#E6DECE')} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28} />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
          <Tooltip content={<ChartTooltip />} />
          <Area type="monotone" dataKey="leads" name="New Leads" stroke={primary} strokeWidth={2.5} fill="url(#ovLeadsGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
          <Line type="monotone" dataKey="converted" name="Converted" stroke={success} strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
          <Line type="monotone" dataKey="lost" name="Lost" stroke={error} strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default LeadActivityTrend;
