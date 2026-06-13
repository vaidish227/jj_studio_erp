import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, TrendingUp, FileText, Briefcase, AlertTriangle, CheckCircle2,
  Activity, Crown, RotateCcw, ArrowRight, ExternalLink,
  Wallet, IndianRupee, Percent, Zap, ArrowUpRight, ArrowDownRight,
  Award, Star, Clock, PackageCheck,
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell,
} from 'recharts';
import useMDDashboard from '../hooks/useMDDashboard';
import DesignerKRAScoreboard from '../../pms/components/dashboard/DesignerKRAScoreboard';

const PERIODS = [
  { id: 'week',    label: 'This Week'    },
  { id: 'month',   label: 'This Month'   },
  { id: 'quarter', label: 'This Quarter' },
  { id: 'all',     label: 'All Time'     },
];

const STATUS_LABEL = {
  draft:               'Draft',
  pending_approval:    'Pending Approval',
  revision_requested:  'Revision',
  manager_approved:    'Manager Approved',
  sent:                'Sent',
  esign_received:      'eSign Received',
  payment_received:    'Payment Received',
  project_ready:       'Project Ready',
  rejected:            'Rejected',
  project_started:     'Project Started',
};

const HEALTH_COLOR = {
  on_track: '#22c55e',
  at_risk:  '#f59e0b',
  blocked:  '#ef4444',
  on_hold:  '#94a3b8',
  delayed:  '#dc2626',
};

const cssVar = (name, fallback = '#000') => {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
};

const formatCurrency = (n) => {
  const num = Number(n) || 0;
  if (Math.abs(num) >= 10000000) return `₹${(num / 10000000).toFixed(2)}Cr`;
  if (Math.abs(num) >= 100000)   return `₹${(num / 100000).toFixed(2)}L`;
  if (Math.abs(num) >= 1000)     return `₹${(num / 1000).toFixed(1)}K`;
  return `₹${num.toLocaleString('en-IN')}`;
};

const TONE_VAR = {
  primary: 'var(--primary)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  error:   'var(--error)',
  accent:  'var(--accent-blue)',
};

const KpiTile = ({ icon: Icon, label, value, suffix = '', delta, tone = 'primary', to }) => {
  const color = TONE_VAR[tone] || 'var(--text-muted)';

  const showDelta = delta !== null && delta !== undefined && delta !== 0;
  const trendUp = (delta ?? 0) > 0;
  const trendColor = trendUp ? 'var(--success)' : 'var(--error)';
  const TrendIcon = trendUp ? ArrowUpRight : ArrowDownRight;

  const inner = (
    <>
      {/* faint oversized watermark of the tile's own icon */}
      <Icon
        size={72}
        className="absolute -right-3 -bottom-3 opacity-[0.06] pointer-events-none"
        style={{ color }}
      />
      <div className="relative flex items-start justify-between gap-2">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
        >
          <Icon size={16} />
        </div>
        {showDelta && (
          <div
            className="inline-flex items-center gap-0.5 text-[10px] font-black px-1.5 py-0.5 rounded-full"
            style={{ background: `color-mix(in srgb, ${trendColor} 14%, transparent)`, color: trendColor }}
          >
            <TrendIcon size={11} strokeWidth={3} />
            {Math.abs(delta)}
          </div>
        )}
      </div>
      <p className="relative text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mt-3">
        {label}
      </p>
      <p className="relative text-2xl font-extrabold text-[var(--text-primary)] leading-tight mt-0.5 tabular-nums">
        {value}{suffix}
      </p>
    </>
  );

  const classes = `relative overflow-hidden text-left w-full rounded-2xl p-4 border transition-all duration-200 ${
    to ? 'hover:-translate-y-0.5 hover:shadow-md cursor-pointer active:scale-[0.98]' : ''
  }`;
  const style = {
    background: `color-mix(in srgb, ${color} 5%, var(--surface))`,
    borderColor: `color-mix(in srgb, ${color} 22%, transparent)`,
  };

  return to
    ? <Link to={to} className={classes} style={style}>{inner}</Link>
    : <div className={classes} style={style}>{inner}</div>;
};

const SectionCard = ({ title, icon: Icon, action, color = 'var(--primary)', children }) => (
  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 h-full flex flex-col transition-all hover:shadow-sm">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={15} style={{ color }} />}
        <h3 className="text-sm font-black uppercase tracking-wider" style={{ color }}>{title}</h3>
      </div>
      {action}
    </div>
    <div className="flex-1 min-h-0">{children}</div>
  </div>
);

const ChartTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-[var(--text-primary)] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-[var(--text-secondary)] flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-bold">{formatter ? formatter(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  );
};

const CRMFunnelCard = ({ funnel }) => {
  const data = (funnel || []).map((f) => ({ stage: f.stage, count: f.count }));
  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <SectionCard title="CRM Funnel" icon={Users} color="var(--primary)"
      action={<Link to="/crm/dashboard" className="text-xs font-semibold text-[var(--primary)] flex items-center gap-1 hover:underline">View CRM <ArrowRight size={11} /></Link>}>
      <div className="space-y-2.5">
        {data.map((row) => {
          const pct = total ? Math.round((row.count / total) * 100) : 0;
          return (
            <div key={row.stage} className="flex items-center gap-3 group">
              <div className="w-28 text-xs font-semibold text-[var(--text-secondary)] truncate">{row.stage}</div>
              <div className="flex-1 h-6 bg-[var(--bg)] rounded-md overflow-hidden relative">
                <div
                  className="absolute inset-y-0 left-0 rounded-md transition-all duration-700 ease-out group-hover:brightness-105"
                  style={{
                    width: `${(row.count / maxCount) * 100}%`,
                    background: 'linear-gradient(90deg, color-mix(in srgb, var(--primary) 88%, transparent), color-mix(in srgb, var(--primary) 52%, transparent))',
                  }}
                />
                <span className="absolute right-2 inset-y-0 flex items-center text-[10px] font-bold text-[var(--text-muted)] tabular-nums">
                  {pct}%
                </span>
              </div>
              <div className="w-10 text-right text-sm font-bold text-[var(--text-primary)] tabular-nums">{row.count}</div>
            </div>
          );
        })}
        {!data.length && <p className="text-xs text-[var(--text-muted)]">No leads in window.</p>}
      </div>
    </SectionCard>
  );
};

const ProposalPipelineCard = ({ pipeline }) => {
  const rows = (pipeline?.byStatus || []).filter((r) => r.count > 0);
  return (
    <SectionCard title="Proposal Pipeline" icon={FileText} color="var(--accent-blue)"
      action={<Link to="/proposal" className="text-xs font-semibold text-[var(--primary)] flex items-center gap-1 hover:underline">View Proposals <ArrowRight size={11} /></Link>}>
      <div className="text-xs grid grid-cols-2 gap-2 mb-3">
        <div className="bg-[var(--bg)] rounded-lg p-2">
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-bold">Open Pipeline</p>
          <p className="text-base font-extrabold text-[var(--text-primary)] tabular-nums mt-0.5">
            {formatCurrency(pipeline?.totalValueOpen)}
          </p>
        </div>
        <div className="bg-[var(--bg)] rounded-lg p-2">
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-bold">Advances</p>
          <p className="text-base font-extrabold text-[var(--success)] tabular-nums mt-0.5">
            {formatCurrency(pipeline?.advanceReceivedThisPeriod)}
          </p>
        </div>
      </div>
      <div className="space-y-1">
        {rows.length === 0 && <p className="text-xs text-[var(--text-muted)]">No active proposals.</p>}
        {rows.map((r) => (
          <div key={r.status} className="flex items-center justify-between py-1 border-b border-[var(--border)]/40 last:border-0">
            <span className="text-xs text-[var(--text-secondary)]">{STATUS_LABEL[r.status] || r.status}</span>
            <span className="flex items-center gap-3">
              <span className="text-[11px] text-[var(--text-muted)] tabular-nums">{formatCurrency(r.amount)}</span>
              <span className="text-sm font-bold text-[var(--text-primary)] tabular-nums w-6 text-right">{r.count}</span>
            </span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
};

const ProjectHealthCard = ({ health }) => {
  const data = [
    { name: 'On Track', value: health?.onTrack || 0, key: 'on_track' },
    { name: 'At Risk',  value: health?.atRisk  || 0, key: 'at_risk' },
    { name: 'Blocked',  value: health?.blocked || 0, key: 'blocked' },
    { name: 'Delayed',  value: health?.delayed || 0, key: 'delayed' },
    { name: 'On Hold',  value: health?.onHold  || 0, key: 'on_hold' },
  ].filter((d) => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <SectionCard title="Project Health" icon={Activity} color="var(--accent-green)"
      action={<Link to="/pms/dashboard" className="text-xs font-semibold text-[var(--primary)] flex items-center gap-1 hover:underline">View PMS <ArrowRight size={11} /></Link>}>
      {total === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">No active projects.</p>
      ) : (
        <div className="grid grid-cols-5 gap-4 items-center">
          {/* donut + centered total overlay */}
          <div className="col-span-2 relative h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none">
                  {data.map((d) => <Cell key={d.key} fill={HEALTH_COLOR[d.key]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-extrabold text-[var(--text-primary)] tabular-nums leading-none">{total}</span>
              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] mt-0.5">Projects</span>
            </div>
          </div>
          {/* custom legend with colored dots + value + share */}
          <ul className="col-span-3 space-y-1.5">
            {data.map((d) => {
              const pct = total ? Math.round((d.value / total) * 100) : 0;
              return (
                <li key={d.key} className="flex items-center gap-2 text-xs px-1.5 py-1 rounded-lg hover:bg-[var(--bg)] transition-colors">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: HEALTH_COLOR[d.key] }} />
                  <span className="font-semibold text-[var(--text-primary)] flex-1 truncate">{d.name}</span>
                  <span className="font-bold text-[var(--text-primary)] tabular-nums">{d.value}</span>
                  <span className="text-[var(--text-muted)] text-[10px] tabular-nums w-8 text-right">{pct}%</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </SectionCard>
  );
};

const ProfitabilityCard = ({ profitability }) => {
  const rows = profitability?.topVariance || [];
  return (
    <SectionCard title="Profitability — Top Variance" icon={Wallet} color="var(--warning)"
      action={<Link to="/pms/analytics" className="text-xs font-semibold text-[var(--primary)] flex items-center gap-1 hover:underline">Analytics <ArrowRight size={11} /></Link>}>
      <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
        <div className="bg-[var(--bg)] rounded-lg p-2">
          <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Budget</p>
          <p className="text-sm font-extrabold text-[var(--text-primary)] tabular-nums">{formatCurrency(profitability?.aggregateBudget)}</p>
        </div>
        <div className="bg-[var(--bg)] rounded-lg p-2">
          <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Spend</p>
          <p className="text-sm font-extrabold text-[var(--text-primary)] tabular-nums">{formatCurrency(profitability?.aggregateSpend)}</p>
        </div>
        <div className="bg-[var(--bg)] rounded-lg p-2">
          <p className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Margin</p>
          <p className={`text-sm font-extrabold tabular-nums ${
            (profitability?.aggregateVariancePct || 0) >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'
          }`}>
            {profitability?.aggregateVariancePct ?? 0}%
          </p>
        </div>
      </div>
      <div className="space-y-1">
        {rows.length === 0 && <p className="text-xs text-[var(--text-muted)]">No project budgets recorded.</p>}
        {rows.map((r) => {
          const positive = r.variancePct >= 0;
          const accent = positive ? 'var(--success)' : 'var(--error)';
          return (
            <Link key={r.projectId} to={`/projects/${r.projectId}`} className="flex items-stretch gap-2.5 group">
              <span className="w-[3px] rounded-full my-1.5 shrink-0" style={{ background: accent }} />
              <div className="flex items-center justify-between flex-1 py-1.5 px-2 -ml-0.5 rounded-md hover:bg-[var(--bg)] transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{r.name}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{r.trackingId} · {r.clientName}</p>
                </div>
                <div className="text-right ml-2">
                  <p className="text-xs font-bold tabular-nums" style={{ color: accent }}>
                    {r.variancePct}%
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] tabular-nums">{formatCurrency(r.variance)}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </SectionCard>
  );
};

const WeeklyTrendCard = ({ trend }) => {
  const primary = cssVar('--primary', '#3A6EA5');
  const success = cssVar('--success', '#22c55e');
  const warning = cssVar('--warning', '#f59e0b');
  const accent  = cssVar('--accent-blue', '#0ea5e9');
  const series = [
    { key: 'leads',           name: 'Leads',            color: primary },
    { key: 'proposalsSent',   name: 'Proposals Sent',   color: accent  },
    { key: 'advances',        name: 'Advances',         color: success },
    { key: 'projectsStarted', name: 'Projects Started', color: warning },
  ];
  const totals = series.map((s) => ({
    ...s,
    total: (trend || []).reduce((sum, d) => sum + (Number(d[s.key]) || 0), 0),
  }));

  return (
    <SectionCard title="12-Week Activity Trend" icon={TrendingUp} color="var(--accent-blue)">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
        {/* chart — two-thirds width */}
        <div className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={230}>
            <ComposedChart data={trend || []} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="mdTrendLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={primary} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={cssVar('--border', '#e5e7eb')} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="leads" name="Leads" stroke={primary} strokeWidth={2.5}
                fill="url(#mdTrendLeads)" activeDot={{ r: 4, strokeWidth: 0 }} dot={false} />
              <Line type="monotone" dataKey="proposalsSent"   name="Proposals Sent"   stroke={accent}  strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              <Line type="monotone" dataKey="advances"        name="Advances"         stroke={success} strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              <Line type="monotone" dataKey="projectsStarted" name="Projects Started" stroke={warning} strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* 12-week totals — fills the remaining third, doubles as legend */}
        <div className="lg:col-span-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">12-week totals</p>
          <div className="space-y-1.5">
            {totals.map((s) => (
              <div
                key={s.key}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2"
                style={{ background: `color-mix(in srgb, ${s.color} 7%, transparent)` }}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="text-xs font-semibold text-[var(--text-secondary)] flex-1 truncate">{s.name}</span>
                <span className="text-lg font-extrabold tabular-nums" style={{ color: s.color }}>{s.total}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionCard>
  );
};

const AlertsRollup = ({ alerts }) => {
  const total = (alerts?.delayedCount || 0)
    + (alerts?.openGates || 0)
    + (alerts?.pendingPdReviews || 0)
    + (alerts?.proposalsAwaitingApproval || 0);

  if (total === 0) {
    return (
      <SectionCard title="Alerts" icon={CheckCircle2} color="var(--success)">
        <p className="text-xs text-[var(--success)] flex items-center gap-1.5">
          <CheckCircle2 size={13} /> No critical alerts. All systems are healthy.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Alerts Rollup" icon={AlertTriangle} color="var(--error)">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <Link to="/pms/dashboard" className="bg-[var(--error)]/10 border border-[var(--error)]/30 rounded-lg p-2 text-center transition-all hover:-translate-y-0.5 hover:shadow-sm hover:bg-[var(--error)]/15">
          <p className="text-2xl font-extrabold text-[var(--error)] tabular-nums">{alerts?.delayedCount || 0}</p>
          <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase mt-0.5">Delayed</p>
        </Link>
        <Link to="/pms/analytics" className="bg-[var(--warning)]/10 border border-[var(--warning)]/30 rounded-lg p-2 text-center transition-all hover:-translate-y-0.5 hover:shadow-sm hover:bg-[var(--warning)]/15">
          <p className="text-2xl font-extrabold text-[var(--warning)] tabular-nums">{alerts?.openGates || 0}</p>
          <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase mt-0.5">Open Gates</p>
        </Link>
        <Link to="/pms/review-design" className="bg-[var(--accent-blue)]/10 border border-[var(--accent-blue)]/30 rounded-lg p-2 text-center transition-all hover:-translate-y-0.5 hover:shadow-sm hover:bg-[var(--accent-blue)]/15">
          <p className="text-2xl font-extrabold text-[var(--accent-blue)] tabular-nums">{alerts?.pendingPdReviews || 0}</p>
          <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase mt-0.5">PD Reviews</p>
        </Link>
        <Link to="/proposal/approval" className="bg-[var(--primary)]/10 border border-[var(--primary)]/30 rounded-lg p-2 text-center transition-all hover:-translate-y-0.5 hover:shadow-sm hover:bg-[var(--primary)]/15">
          <p className="text-2xl font-extrabold text-[var(--primary)] tabular-nums">{alerts?.proposalsAwaitingApproval || 0}</p>
          <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase mt-0.5">Proposals</p>
        </Link>
      </div>
      {(alerts?.topDelayedProjects?.length || 0) > 0 && (
        <div>
          <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)] mb-2">Top Delayed Projects</p>
          <div className="space-y-1">
            {alerts.topDelayedProjects.map((p) => (
              <Link key={p._id} to={`/projects/${p._id}`} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-[var(--bg)] transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{p.name}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{p.trackingId}{p.clientName ? ` · ${p.clientName}` : ''}</p>
                </div>
                <span className="text-xs font-bold text-[var(--error)] tabular-nums ml-2">{p.daysLate}d late</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
};

const QuickLinks = () => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
    {[
      { to: '/crm/dashboard',  label: 'CRM Dashboard'  },
      { to: '/pms/dashboard',  label: 'PMS Dashboard'  },
      { to: '/pms/analytics',  label: 'PMS Analytics'  },
      { to: '/proposal/approval', label: 'Approvals'   },
    ].map((l) => (
      <Link
        key={l.to}
        to={l.to}
        className="flex items-center justify-between bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--primary)]/40 hover:text-[var(--primary)] transition-colors"
      >
        {l.label}
        <ExternalLink size={13} />
      </Link>
    ))}
  </div>
);

// ── Designer Performance — team KPI ribbon + KRA leaderboard ─────────────────
const DesignerPerformance = ({ designerPerformance, period }) => {
  const summary = designerPerformance?.summary || {};
  const designers = designerPerformance?.designers || [];
  const avg = summary.avgKraScore ?? 0;
  const kraTone = avg >= 4 ? 'success' : avg >= 3 ? 'warning' : avg > 0 ? 'error' : 'primary';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Award size={15} className="text-[var(--primary)]" />
        <h3 className="text-sm font-black uppercase tracking-wider text-[var(--primary)]">
          Designer Performance — KPI &amp; KRA
        </h3>
      </div>

      {/* team KPI ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiTile icon={Star}         label="Avg KRA Score"    value={avg}                     suffix=" / 5" tone={kraTone} />
        <KpiTile icon={Clock}        label="On-Time"          value={summary.onTimePct ?? 0}    suffix="%"   tone="success" />
        <KpiTile icon={CheckCircle2} label="First-Pass"       value={summary.firstPassPct ?? 0} suffix="%"   tone="accent" />
        <KpiTile icon={PackageCheck} label="Delivered"        value={summary.delivered ?? 0}                 tone="primary" />
        <KpiTile icon={Users}        label="Active Designers" value={summary.activeDesigners ?? 0}           tone="primary" />
      </div>

      {/* KRA leaderboard (reuses the existing PMS scoreboard component) */}
      <DesignerKRAScoreboard designers={designers} period={period} />
    </div>
  );
};

const HeroStat = ({ label, value, sub, tone = 'var(--text-primary)' }) => (
  <div className="relative">
    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
    <p className="text-3xl font-extrabold tabular-nums leading-tight mt-1" style={{ color: tone }}>{value}</p>
    {sub && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{sub}</p>}
  </div>
);

// Gradient headline band — gives the executive view a single focal point,
// re-surfacing the three cross-module story metrics above the detailed KPI strip.
const ExecutiveHero = ({ k, pipeline }) => {
  const conv = k.conversionRate?.value ?? 0;
  const onTrack = k.onTrackPct?.value ?? 0;
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 sm:p-6 border"
      style={{
        borderColor: 'color-mix(in srgb, var(--primary) 30%, transparent)',
        background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 14%, var(--surface)), var(--surface) 72%)',
      }}
    >
      <Crown size={150} className="absolute -right-6 -top-8 opacity-[0.07] text-[var(--primary)] pointer-events-none" />
      <div className="relative">
        <div className="flex items-center gap-1.5 mb-4">
          <Zap size={13} className="text-[var(--primary)]" />
          <span className="text-[11px] font-black uppercase tracking-widest text-[var(--primary)]">Executive snapshot</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-4">
          <HeroStat label="Conversion Rate" value={`${conv}%`} sub="Leads converted this period" tone="var(--success)" />
          <HeroStat label="Open Pipeline" value={formatCurrency(pipeline?.totalValueOpen)} sub="Live proposal value" />
          <HeroStat label="Projects On-Track" value={`${onTrack}%`} sub="Active project health" tone="var(--accent-blue)" />
        </div>
      </div>
    </div>
  );
};

const MDDashboardPage = () => {
  const [period, setPeriod] = useState('month');
  const { data, isLoading, error, refresh } = useMDDashboard(period);

  const k = data?.executiveKpis || {};

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/12 text-[var(--primary)] flex items-center justify-center">
            <Crown size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] leading-tight">MD Dashboard</h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Executive cross-module overview — CRM, proposals, projects, and finance.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="text-sm font-semibold bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 outline-none focus:border-[var(--primary)] cursor-pointer"
          >
            {PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <button
            type="button"
            onClick={refresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--primary)] hover:border-[var(--primary)]/40 transition-colors disabled:opacity-50"
          >
            <RotateCcw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)] rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {isLoading && !data ? (
        <div className="flex items-center justify-center min-h-[50vh] text-[var(--text-muted)] text-sm">Loading executive overview…</div>
      ) : (
        <>
          {/* Executive hero band */}
          <ExecutiveHero k={k} pipeline={data?.proposalPipeline} />

          {/* Executive KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiTile icon={Users}         label="Total Leads"       value={k.totalLeads?.value ?? 0}      delta={k.totalLeads?.delta}    tone="primary" to="/crm/dashboard" />
            <KpiTile icon={Activity}      label="Active Pipeline"   value={k.activePipeline?.value ?? 0}  tone="accent"  to="/crm/dashboard" />
            <KpiTile icon={TrendingUp}    label="Conversion"        value={k.conversionRate?.value ?? 0} suffix="%" delta={k.conversionRate?.delta} tone="success" />
            <KpiTile icon={FileText}      label="Proposals Sent"    value={k.proposalsSent?.value ?? 0}   delta={k.proposalsSent?.delta} tone="accent"  to="/proposal" />
            <KpiTile icon={Wallet}        label="Advances"          value={formatCurrency(k.advanceReceivedAmount?.value)} tone="success" />
            <KpiTile icon={IndianRupee}   label="Open Pipeline"     value={formatCurrency(data?.proposalPipeline?.totalValueOpen)} tone="accent" to="/proposal" />
            <KpiTile icon={Briefcase}     label="Active Projects"   value={k.activeProjects?.value ?? 0}  delta={k.activeProjects?.delta} tone="primary" to="/projects" />
            <KpiTile icon={CheckCircle2}  label="On-Track"          value={k.onTrackPct?.value ?? 0}     suffix="%" tone="success" to="/pms/dashboard" />
            <KpiTile icon={AlertTriangle} label="Delayed Projects"  value={k.delayedProjects?.value ?? 0} tone="error"  to="/pms/dashboard" />
            <KpiTile icon={Percent}       label="Profit Margin"     value={k.openProfitVariancePct?.value ?? 0} suffix="%" tone={(k.openProfitVariancePct?.value ?? 0) >= 0 ? 'success' : 'error'} to="/pms/analytics" />
          </div>

          {/* Two-column grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CRMFunnelCard funnel={data?.crmFunnel} />
            <ProposalPipelineCard pipeline={data?.proposalPipeline} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ProjectHealthCard health={data?.projectHealth} />
            <ProfitabilityCard profitability={data?.profitability} />
          </div>

          {/* Designer performance — KPI ribbon + KRA leaderboard */}
          <DesignerPerformance designerPerformance={data?.designerPerformance} period={period} />

          {/* Weekly trend */}
          <WeeklyTrendCard trend={data?.weeklyTrend} />

          {/* Alerts rollup */}
          <AlertsRollup alerts={data?.alerts} />

          {/* Quick links footer */}
          <QuickLinks />
        </>
      )}
    </div>
  );
};

export default MDDashboardPage;
