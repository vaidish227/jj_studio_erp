import React from 'react';
import { Activity, CheckCircle2, AlertTriangle, AlertCircle, PauseCircle } from 'lucide-react';

/**
 * ProjectHealthChart — single horizontal stacked bar showing the split of
 * active projects across health states. Built with plain CSS (flex) rather
 * than recharts because a 100%-stacked bar with labels reads better hand-rolled.
 */

const SERIES = [
  { key: 'onTrack', label: 'On Track',  icon: CheckCircle2,  color: 'var(--success)'    },
  { key: 'atRisk',  label: 'At Risk',   icon: AlertTriangle, color: 'var(--warning)'    },
  { key: 'blocked', label: 'Blocked',   icon: AlertCircle,   color: 'var(--error)'      },
  { key: 'onHold',  label: 'On Hold',   icon: PauseCircle,   color: 'var(--text-muted)' },
];

const ProjectHealthChart = ({ data = {} }) => {
  const total = SERIES.reduce((s, x) => s + (data[x.key] || 0), 0);

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 lg:p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-[var(--primary)]" />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Project Health</h3>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
          {total} active
        </span>
      </div>

      {total === 0 ? (
        <div className="py-12 text-center text-sm text-[var(--text-muted)]">
          No active projects yet.
        </div>
      ) : (
        <>
          {/* The stacked bar */}
          <div className="h-3 w-full rounded-full bg-[var(--bg)] overflow-hidden flex">
            {SERIES.map((s) => {
              const v = data[s.key] || 0;
              const pct = total > 0 ? (v / total) * 100 : 0;
              if (pct === 0) return null;
              return (
                <div
                  key={s.key}
                  style={{ width: `${pct}%`, background: s.color }}
                  className="transition-all duration-500"
                  title={`${s.label}: ${v}`}
                />
              );
            })}
          </div>

          {/* Legend rows */}
          <ul className="mt-5 grid grid-cols-2 gap-3 flex-1">
            {SERIES.map((s) => {
              const v = data[s.key] || 0;
              const pct = total > 0 ? Math.round((v / total) * 100) : 0;
              const Icon = s.icon;
              return (
                <li
                  key={s.key}
                  className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg)]/40"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${s.color}1f`, color: s.color }}
                  >
                    <Icon size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                      {s.label}
                    </p>
                    <p className="text-lg font-extrabold text-[var(--text-primary)] leading-tight">
                      {v}
                      <span className="text-xs font-bold text-[var(--text-muted)] ml-1.5">{pct}%</span>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
};

export default ProjectHealthChart;
