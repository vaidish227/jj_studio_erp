import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Layers } from 'lucide-react';
import { cssVarToHex, SERIES_PALETTE } from './chartColors';

/**
 * WorkByProjectDonut — distribution of the designer's open action items by
 * project. Answers "where is my effort concentrated / am I overloaded on one
 * project?". Clicking a slice or legend row filters the Action Queue to that
 * project (action-driving, not decorative).
 */
const DonutTooltip = ({ active, payload, total }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-[var(--text-primary)] truncate max-w-[180px]">{d.name}</p>
      <p className="text-[var(--text-muted)]">{d.value} task{d.value === 1 ? '' : 's'} · {pct}%</p>
    </div>
  );
};

const WorkByProjectDonut = ({ data = [], activeId, onSelect }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  const colored = data.map((d, i) => ({ ...d, color: SERIES_PALETTE[i % SERIES_PALETTE.length] }));

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 h-full">
      <div className="flex items-center gap-2 mb-3">
        <Layers size={14} className="text-[var(--primary)]" />
        <h2 className="text-sm font-black uppercase tracking-wider text-[var(--text-secondary)]">Work by Project</h2>
        <span className="text-[10px] font-bold text-[var(--text-muted)] ml-auto">{total} open</span>
      </div>

      {total === 0 ? (
        <div className="text-center py-8 text-[var(--text-muted)]">
          <Layers size={22} className="mx-auto mb-2 opacity-20" />
          <p className="text-xs">No open tasks to distribute.</p>
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-3 items-center">
          <div className="col-span-2 relative h-36">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={colored}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={42}
                  outerRadius={62}
                  paddingAngle={2}
                  stroke="none"
                  cursor="pointer"
                  onClick={(_, index) => onSelect?.(colored[index].id, colored[index].name)}
                >
                  {colored.map((d) => (
                    <Cell
                      key={d.id}
                      fill={cssVarToHex(d.color)}
                      opacity={activeId && activeId !== d.id ? 0.3 : 1}
                    />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip total={total} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <p className="text-2xl font-extrabold text-[var(--text-primary)] leading-none">{total}</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">tasks</p>
            </div>
          </div>

          <ul className="col-span-3 space-y-1">
            {colored.map((d) => {
              const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
              const dim = activeId && activeId !== d.id;
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => onSelect?.(d.id, d.name)}
                    className={`w-full flex items-center gap-2 text-xs rounded-lg px-1.5 py-1 hover:bg-[var(--bg)] transition-colors
                      ${activeId === d.id ? 'bg-[var(--primary)]/10' : ''} ${dim ? 'opacity-50' : ''}`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cssVarToHex(d.color) }} />
                    <span className="font-semibold text-[var(--text-primary)] flex-1 truncate text-left">{d.name}</span>
                    <span className="text-[var(--text-muted)] font-bold tabular-nums">{d.value}</span>
                    <span className="text-[var(--text-muted)] text-[10px] tabular-nums w-8 text-right">{pct}%</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default WorkByProjectDonut;
