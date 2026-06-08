import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Workflow } from 'lucide-react';

/**
 * PhaseDistributionChart — donut chart of projects-per-phase.
 * 7 phases share a stable colour map so charts feel consistent across periods.
 */

const PHASE_LABEL = {
  kickoff:     'Kickoff',
  layout:      'Layout',
  design:      'Design',
  procurement: 'Procurement',
  release:     'Release',
  execution:   'Execution',
  handover:    'Handover',
};

// Resolved against the runtime stylesheet — used at render time so the chart
// matches the theme (light/dark) without rebuilding.
const PHASE_COLOR = {
  kickoff:     'var(--text-muted)',
  layout:      'var(--accent-teal)',
  design:      'var(--primary)',
  procurement: 'var(--accent-blue)',
  release:     'var(--warning)',
  execution:   'var(--success)',
  handover:    'var(--accent-green)',
};

const cssVarToHex = (varName) => {
  if (typeof window === 'undefined') return varName;
  const m = /var\((--[^)]+)\)/.exec(varName);
  if (!m) return varName;
  const v = getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim();
  return v || varName;
};

const PhaseTooltip = ({ active, payload, total }) => {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-[var(--text-primary)]">{PHASE_LABEL[item.name] || item.name}</p>
      <p className="text-[var(--text-muted)]">{item.value} project{item.value === 1 ? '' : 's'} · {pct}%</p>
    </div>
  );
};

const PhaseDistributionChart = ({ data = [] }) => {
  const total = data.reduce((s, d) => s + d.count, 0);
  const enriched = data.map((d) => ({ name: d.phase, value: d.count }));
  const hasData = total > 0;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 lg:p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Workflow size={16} className="text-[var(--primary)]" />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Phase Distribution</h3>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
          {total} active
        </span>
      </div>

      {!hasData ? (
        <div className="py-12 text-center text-sm text-[var(--text-muted)]">
          No active projects yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-center">
          <div className="sm:col-span-3 relative h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={enriched}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={88}
                  paddingAngle={2}
                  stroke="none"
                  startAngle={90}
                  endAngle={-270}
                >
                  {enriched.map((entry) => (
                    <Cell key={entry.name} fill={cssVarToHex(PHASE_COLOR[entry.name] || 'var(--text-muted)')} />
                  ))}
                </Pie>
                <Tooltip content={<PhaseTooltip total={total} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Total</p>
              <p className="text-2xl font-extrabold text-[var(--text-primary)]">{total}</p>
            </div>
          </div>

          <ul className="sm:col-span-2 space-y-1.5">
            {data.map((d) => {
              const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
              return (
                <li key={d.phase} className="flex items-center gap-2 text-xs">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: cssVarToHex(PHASE_COLOR[d.phase] || 'var(--text-muted)') }}
                  />
                  <span className="font-semibold text-[var(--text-primary)] capitalize flex-1 truncate">
                    {PHASE_LABEL[d.phase] || d.phase}
                  </span>
                  <span className="text-[var(--text-muted)] font-bold tabular-nums">{d.count}</span>
                  <span className="text-[var(--text-muted)] text-[10px] tabular-nums w-8 text-right">{pct}%</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PhaseDistributionChart;
