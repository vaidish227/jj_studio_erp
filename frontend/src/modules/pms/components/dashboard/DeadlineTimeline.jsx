import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { CalendarClock } from 'lucide-react';
import { cssVarToHex } from './chartColors';

/**
 * DeadlineTimeline — number of the designer's deadlines per day across the next
 * two weeks. Answers "what's the shape of my week — bunched or spread?" so they
 * can rebalance before a crunch. Clicking a day filters the Action Queue to it.
 *
 * Visual encoding:
 *  - Today        → amber (warning), labelled "Today"
 *  - This week    → full-strength primary
 *  - Next week    → lighter primary (de-emphasised, further away)
 *  - Weekend ticks are muted; counts are printed above each bar.
 */
const TimelineTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  if (!d.count) return null;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-[var(--text-primary)]">{d.label} · {d.count} deadline{d.count === 1 ? '' : 's'}</p>
      <ul className="mt-1 space-y-0.5">
        {d.tasks.slice(0, 4).map((t, i) => (
          <li key={i} className="text-[var(--text-muted)] truncate max-w-[200px]">• {t}</li>
        ))}
        {d.tasks.length > 4 && <li className="text-[var(--text-muted)]">+{d.tasks.length - 4} more</li>}
      </ul>
    </div>
  );
};

// Count printed above each bar (skipped for empty days).
const CountLabel = ({ x, y, width, value }) => {
  if (!value) return null;
  return (
    <text
      x={x + width / 2} y={y - 5} textAnchor="middle"
      fontSize={11} fontWeight={800} fill={cssVarToHex('var(--text-secondary)')}
    >
      {value}
    </text>
  );
};

// X-axis day tick — "Today" highlighted, weekends muted.
const DayTick = ({ x, y, payload, days, todayTs }) => {
  const d = days.find((it) => it.label === payload.value);
  const ts = d?.ts;
  const isToday = ts === todayTs;
  const dow = ts != null ? new Date(ts).getDay() : 1;
  const weekend = dow === 0 || dow === 6;
  const fill = cssVarToHex(isToday ? 'var(--warning)' : weekend ? 'var(--text-muted)' : 'var(--text-secondary)');
  return (
    <g>
      <text x={x} y={y + 11} textAnchor="middle" fontSize={9} fontWeight={isToday ? 800 : 600} fill={fill}>
        {isToday ? 'TODAY' : payload.value}
      </text>
    </g>
  );
};

const DeadlineTimeline = ({ days = [], activeTs, onSelectDay }) => {
  const total = days.reduce((s, d) => s + d.count, 0);
  const todayTs = days[0]?.ts;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <CalendarClock size={14} className="text-[var(--accent-blue)]" />
        <h2 className="text-sm font-black uppercase tracking-wider text-[var(--text-secondary)]">Upcoming Deadlines</h2>
        <div className="ml-auto flex items-center gap-3">
          <span className="flex items-center gap-1 text-[10px] font-bold text-[var(--text-muted)]">
            <span className="w-2 h-2 rounded-full" style={{ background: cssVarToHex('var(--warning)') }} /> Today
          </span>
          <span className="flex items-center gap-1 text-[10px] font-bold text-[var(--text-muted)]">
            <span className="w-2 h-2 rounded-full" style={{ background: cssVarToHex('var(--primary)') }} /> This week
          </span>
          <span className="text-[10px] font-bold text-[var(--text-muted)]">next 14 days</span>
        </div>
      </div>

      {total === 0 ? (
        <div className="text-center py-8 text-[var(--text-muted)]">
          <CalendarClock size={22} className="mx-auto mb-2 opacity-20" />
          <p className="text-xs">No deadlines in the next two weeks.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={days} margin={{ top: 18, right: 4, left: 4, bottom: 0 }} barCategoryGap="22%">
            <XAxis
              dataKey="label"
              interval={0}
              tickLine={false}
              axisLine={{ stroke: cssVarToHex('var(--border)') }}
              height={22}
              tick={<DayTick days={days} todayTs={todayTs} />}
            />
            <Tooltip cursor={{ fill: 'color-mix(in srgb, var(--text-muted) 6%, transparent)' }} content={<TimelineTooltip />} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={26} cursor="pointer"
              onClick={(entry) => onSelectDay?.(entry.ts, entry.label)}>
              <LabelList dataKey="count" content={<CountLabel />} />
              {days.map((d, i) => {
                const isToday = d.ts === todayTs;
                const base = isToday ? 'var(--warning)' : 'var(--primary)';
                const proximity = i <= 6 ? 1 : 0.5;            // next week is de-emphasised
                const op = activeTs && activeTs !== d.ts ? 0.22 : proximity;
                return <Cell key={d.ts} fill={cssVarToHex(base)} opacity={op} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default DeadlineTimeline;
