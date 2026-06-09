import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { FileStack } from 'lucide-react';
import { cssVarToHex } from './chartColors';

/**
 * DrawingStatusDonut — distribution of the designer's drawings by workflow
 * status. Answers "where are my deliverables stuck?" (a pile of rejected =
 * rework backlog; a pile in-review = approval logjam). Clicking opens the
 * drawing library so the designer can act on the stuck items.
 */
const STATUS = [
  { key: 'draft',             label: 'Draft',     color: 'var(--text-muted)' },
  { key: 'sent_for_approval', label: 'In Review', color: 'var(--warning)' },
  { key: 'approved',          label: 'Approved',  color: 'var(--accent-green)' },
  { key: 'rejected',          label: 'Rejected',  color: 'var(--error)' },
  { key: 'released_to_site',  label: 'Released',  color: 'var(--primary)' },
];

const DonutTooltip = ({ active, payload, total }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-[var(--text-primary)]">{d.label}</p>
      <p className="text-[var(--text-muted)]">{d.value} drawing{d.value === 1 ? '' : 's'} · {pct}%</p>
    </div>
  );
};

const DrawingStatusDonut = ({ byStatus = {}, onNavigate }) => {
  const data = STATUS.map((s) => ({ ...s, value: byStatus[s.key] || 0 })).filter((d) => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 h-full">
      <div className="flex items-center gap-2 mb-3">
        <FileStack size={14} className="text-[var(--accent-blue)]" />
        <h2 className="text-sm font-black uppercase tracking-wider text-[var(--text-secondary)]">Drawing Status</h2>
        <span className="text-[10px] font-bold text-[var(--text-muted)] ml-auto">{total} total</span>
      </div>

      {total === 0 ? (
        <div className="text-center py-8 text-[var(--text-muted)]">
          <FileStack size={22} className="mx-auto mb-2 opacity-20" />
          <p className="text-xs">No drawings yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-3 items-center">
          <div className="col-span-2 relative h-36">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={42}
                  outerRadius={62}
                  paddingAngle={2}
                  stroke="none"
                  cursor="pointer"
                  onClick={(_, index) => onNavigate?.(data[index].key)}
                >
                  {data.map((d) => (
                    <Cell key={d.key} fill={cssVarToHex(d.color)} />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip total={total} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <p className="text-2xl font-extrabold text-[var(--text-primary)] leading-none">{total}</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">drawings</p>
            </div>
          </div>

          <ul className="col-span-3 space-y-1">
            {data.map((d) => {
              const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
              return (
                <li key={d.key}>
                  <button
                    type="button"
                    onClick={() => onNavigate?.(d.key)}
                    className="w-full flex items-center gap-2 text-xs rounded-lg px-1.5 py-1 hover:bg-[var(--bg)] transition-colors"
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cssVarToHex(d.color) }} />
                    <span className="font-semibold text-[var(--text-primary)] flex-1 truncate text-left">{d.label}</span>
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

export default DrawingStatusDonut;
