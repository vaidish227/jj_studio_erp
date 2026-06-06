import React from 'react';
import {
  Briefcase, TrendingUp, AlertTriangle, Lock, Eye, CheckCircle2,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * KPIStrip — 6 tiles. Compact, scannable, click-through.
 * We hand-roll the tile (rather than reusing DashboardCard) so the layout is
 * uniformly dense for this strip and we can show trend deltas neatly.
 */

const Tile = ({ icon: Icon, label, value, suffix = '', trend, redirectPath, tone }) => {
  const navigate = useNavigate();
  const toneClasses = {
    primary:  'text-[var(--primary)] bg-[var(--primary)]/12',
    success:  'text-[var(--success)] bg-[var(--success)]/12',
    warning:  'text-[var(--warning)] bg-[var(--warning)]/12',
    error:    'text-[var(--error)] bg-[var(--error)]/12',
    accent:   'text-[var(--accent-blue)] bg-[var(--accent-blue)]/12',
  }[tone] || 'text-[var(--text-muted)] bg-[var(--bg)]';

  const showTrend = trend !== null && trend !== undefined && trend !== 0;
  const trendUp = (trend ?? 0) > 0;
  const trendColor = trendUp ? 'text-[var(--success)]' : 'text-[var(--error)]';

  return (
    <button
      type="button"
      onClick={redirectPath ? () => navigate(redirectPath) : undefined}
      disabled={!redirectPath}
      className={`text-left w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 transition-all ${
        redirectPath ? 'hover:border-[var(--primary)]/40 hover:shadow-sm cursor-pointer' : 'cursor-default'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${toneClasses}`}>
          <Icon size={16} />
        </div>
        {showTrend && (
          <div className={`flex items-center gap-0.5 text-[10px] font-black ${trendColor}`}>
            {trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(trend)}
          </div>
        )}
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mt-3">
        {label}
      </p>
      <p className="text-2xl font-extrabold text-[var(--text-primary)] leading-tight mt-0.5">
        {value}{suffix}
      </p>
    </button>
  );
};

const KPIStrip = ({ kpis }) => {
  if (!kpis) return null;
  const t = kpis.trends || {};

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <Tile
        icon={Briefcase}
        label="Active Projects"
        value={kpis.activeProjects ?? 0}
        trend={t.activeProjects}
        redirectPath="/projects"
        tone="primary"
      />
      <Tile
        icon={TrendingUp}
        label="On-Track"
        value={kpis.onTrackPct ?? 0}
        suffix="%"
        trend={t.onTrackPct}
        tone="success"
      />
      <Tile
        icon={AlertTriangle}
        label="Delayed"
        value={kpis.delayedCount ?? 0}
        trend={t.delayedCount}
        tone="warning"
      />
      <Tile
        icon={Lock}
        label="Pending Sign-offs"
        value={kpis.openGates ?? 0}
        trend={t.openGates}
        redirectPath="/pms/analytics"
        tone="accent"
      />
      <Tile
        icon={Eye}
        label="PD Reviews"
        value={kpis.pendingPdReviews ?? 0}
        trend={t.pendingPdReviews}
        redirectPath="/pms/review-design"
        tone="primary"
      />
      <Tile
        icon={CheckCircle2}
        label="Released"
        value={kpis.releasedThisPeriod ?? 0}
        trend={t.releasedThisPeriod}
        tone="success"
      />
    </div>
  );
};

export default KPIStrip;
