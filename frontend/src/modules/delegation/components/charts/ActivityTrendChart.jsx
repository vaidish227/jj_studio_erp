import { useMemo } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { resolveVar } from './chartTheme';

// ActivityTrendChart — 14-day "Created vs Completed" area chart. Gives the
// dashboard a sense of momentum (is the team keeping up with incoming work?).
// `data`: [{ date: 'YYYY-MM-DD', created, completed }].

const fmtDay = (iso) => {
  // 'YYYY-MM-DD' → 'D Mon' without pulling in a date lib or risking TZ shifts.
  const [, m, d] = iso.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(d)} ${months[Number(m) - 1]}`;
};

const TrendTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-[var(--text-primary)] mb-1">{fmtDay(label)}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-[var(--text-secondary)] flex items-center gap-1.5 capitalize">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-bold text-[var(--text-primary)]">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

const ActivityTrendChart = ({ data = [] }) => {
  const created = resolveVar('var(--primary)');
  const completed = resolveVar('var(--success)');
  const grid = resolveVar('var(--border)');
  const axis = resolveVar('var(--text-muted)');

  const hasData = useMemo(() => data.some((d) => d.created || d.completed), [data]);

  if (!hasData) {
    return <div className="h-full min-h-[16rem] flex items-center justify-center text-sm text-[var(--text-muted)]">No activity in the last 14 days.</div>;
  }

  return (
    <div className="h-full min-h-[16rem] -ml-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="dlgCreated" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={created} stopOpacity={0.35} />
              <stop offset="100%" stopColor={created} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="dlgCompleted" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={completed} stopOpacity={0.35} />
              <stop offset="100%" stopColor={completed} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={fmtDay}
            tick={{ fontSize: 10, fill: axis }}
            tickLine={false}
            axisLine={{ stroke: grid }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            allowDecimals={false}
            width={28}
            tick={{ fontSize: 10, fill: axis }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<TrendTooltip />} />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(v) => <span className="text-[var(--text-secondary)] capitalize">{v}</span>}
          />
          <Area type="monotone" dataKey="created" stroke={created} strokeWidth={2} fill="url(#dlgCreated)" />
          <Area type="monotone" dataKey="completed" stroke={completed} strokeWidth={2} fill="url(#dlgCompleted)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ActivityTrendChart;
