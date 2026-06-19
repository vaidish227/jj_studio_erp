import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell, Tooltip, CartesianGrid,
} from 'recharts';
import { resolveVar } from './chartTheme';

// WorkloadChart — open delegations per department as a horizontal bar chart.
// Each bar keeps its department's own color; "Unassigned" falls back to gold.
const WorkloadTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full" style={{ background: d.fill }} />
        {d.name}
      </p>
      <p className="text-[var(--text-muted)]">{d.count} open delegation{d.count === 1 ? '' : 's'}</p>
    </div>
  );
};

const WorkloadChart = ({ workload = [] }) => {
  if (!workload.length) {
    return <div className="h-full flex items-center justify-center text-sm text-[var(--text-muted)]">No open delegations.</div>;
  }

  const data = workload.map((w) => ({
    name: w.name,
    count: w.count,
    fill: resolveVar(w.color || 'var(--primary)'),
  }));
  const axis = resolveVar('var(--text-muted)');
  const grid = resolveVar('var(--border)');

  // Fills the (fixed-height) card; scrolls if a long department list outgrows it.
  return (
    <div className="h-full min-h-[120px] overflow-y-auto">
      <ResponsiveContainer width="100%" height="100%" minHeight={Math.max(120, data.length * 34)}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap={10}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
          <XAxis type="number" allowDecimals={false} domain={[0, (max) => Math.max(1, max)]} tick={{ fontSize: 10, fill: axis }} tickLine={false} axisLine={{ stroke: grid }} />
          <YAxis
            type="category"
            dataKey="name"
            width={104}
            tick={{ fontSize: 11, fill: axis }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<WorkloadTooltip />} cursor={{ fill: 'var(--bg)' }} />
          <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={22}>
            {data.map((d) => <Cell key={d.name} fill={d.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default WorkloadChart;
