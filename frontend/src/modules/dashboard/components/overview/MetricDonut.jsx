import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import ChartTooltip from '../common/ChartTooltip';

// MetricDonut — a donut with a centered total overlay and a value/share legend.
// `data`: [{ label, value, color }]. Used for source mix, status mix, etc.
const MetricDonut = ({ data = [], centerLabel = 'Total', size = 180 }) => {
  const clean = data.filter((d) => (d.value || 0) > 0);
  const total = clean.reduce((s, d) => s + (d.value || 0), 0);

  if (!total) {
    return (
      <div className="flex items-center justify-center text-sm text-[var(--text-muted)] py-10">
        No data to show.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={clean}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={size * 0.31}
              outerRadius={size * 0.47}
              paddingAngle={2}
              stroke="none"
            >
              {clean.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-extrabold text-[var(--text-primary)] tabular-nums leading-none">{total}</span>
          <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] mt-0.5">{centerLabel}</span>
        </div>
      </div>

      <ul className="w-full space-y-1">
        {clean.map((d, i) => {
          const pct = Math.round((d.value / total) * 100);
          return (
            <li key={i} className="flex items-center gap-2 text-xs px-1.5 py-1 rounded-lg hover:bg-[var(--bg)] transition-colors">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
              <span className="font-semibold text-[var(--text-primary)] flex-1 truncate">{d.label}</span>
              <span className="font-bold text-[var(--text-primary)] tabular-nums">{d.value}</span>
              <span className="text-[var(--text-muted)] text-[10px] tabular-nums w-8 text-right">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default MetricDonut;
