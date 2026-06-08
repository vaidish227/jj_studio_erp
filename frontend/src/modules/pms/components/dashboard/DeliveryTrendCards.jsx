import React from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';

const cssVar = (name, fallback = '#000') => {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
};

const TrendTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-[var(--text-primary)] mb-1">Week of {label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-[var(--text-secondary)] flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
          {p.name}: <span className="font-bold text-[var(--text-primary)]">{p.value ?? '—'}{p.name.includes('%') ? '%' : ''}</span>
        </p>
      ))}
    </div>
  );
};

/**
 * Two-up trend cards for the main PMS dashboard.
 *   • Left:  Delivered vs Delayed (stacked bar — last 12 weeks)
 *   • Right: On-Time % (line — last 12 weeks)
 *
 * Driven by `getOverview.weeklyTrend` (Phase D backend addition).
 */
const DeliveryTrendCards = ({ data = [] }) => {
  if (!data?.length) return null;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Delivered vs Delayed */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 h-full flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 size={15} className="text-[var(--primary)]" />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Delivery Trend — Last 12 Weeks</h3>
        </div>
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--border', '#e5e7eb')} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: cssVar('--text-muted', '#94a3b8') }} />
              <YAxis tick={{ fontSize: 10, fill: cssVar('--text-muted', '#94a3b8') }} allowDecimals={false} />
              <Tooltip content={<TrendTooltip />} cursor={{ fill: 'transparent' }} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
              <Bar dataKey="onTime"  name="On-Time"  stackId="a" fill={cssVar('--success', '#22c55e')} radius={[0, 0, 0, 0]} />
              <Bar dataKey="delayed" name="Delayed"  stackId="a" fill={cssVar('--error', '#ef4444')}   radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* On-Time % trend */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 h-full flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={15} className="text-[var(--accent-blue)]" />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">On-Time % — Last 12 Weeks</h3>
        </div>
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--border', '#e5e7eb')} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: cssVar('--text-muted', '#94a3b8') }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: cssVar('--text-muted', '#94a3b8') }} />
              <Tooltip content={<TrendTooltip />} />
              <Line
                type="monotone"
                dataKey="onTimePct"
                name="On-Time %"
                stroke={cssVar('--accent-blue', '#3b82f6')}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default DeliveryTrendCards;
