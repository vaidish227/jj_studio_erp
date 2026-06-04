import React from 'react';
import { Lock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const cssVar = (name) => {
  if (typeof window === 'undefined') return name;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || name;
};

const BUCKET_COLOR = {
  success: () => cssVar('--success'),
  warning: () => cssVar('--warning'),
  error:   () => cssVar('--error'),
  danger:  () => '#7c2d12',
};

const GateTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-[var(--text-primary)]">{p.label}</p>
      <p className="text-[var(--text-muted)]">
        {p.count} open gate{p.count === 1 ? '' : 's'}
      </p>
    </div>
  );
};

const GateAgingBars = ({ data }) => {
  const buckets = data?.buckets || [];
  const total = data?.total || 0;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 lg:p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lock size={16} className="text-[var(--accent-blue)]" />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Gate Aging</h3>
        </div>
        <Link
          to="/pms/analytics"
          className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors inline-flex items-center gap-1"
        >
          Detail <ArrowRight size={11} />
        </Link>
      </div>

      {total === 0 ? (
        <div className="flex-1 py-10 text-center text-sm text-[var(--text-muted)]">
          🎉 All gates clear.
        </div>
      ) : (
        <>
          <div className="flex-1 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={buckets} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fill: cssVar('--text-muted'), fontSize: 10, fontWeight: 700 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: cssVar('--text-muted'), fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Tooltip cursor={{ fill: 'rgba(127,127,127,0.06)' }} content={<GateTooltip />} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {buckets.map((b) => (
                    <Cell key={b.label} fill={(BUCKET_COLOR[b.tone] || BUCKET_COLOR.success)()} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-[var(--text-muted)] mt-2 text-center">
            {total} open gate{total === 1 ? '' : 's'} across all projects
          </p>
        </>
      )}
    </div>
  );
};

export default GateAgingBars;
