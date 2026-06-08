import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, TrendingUp, FileText, Briefcase, AlertTriangle, CheckCircle2,
  Activity, Crown, RotateCcw, ArrowRight, ExternalLink,
  Wallet, IndianRupee, Percent,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend,
} from 'recharts';
import useMDDashboard from '../hooks/useMDDashboard';

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

const KpiTile = ({ icon: Icon, label, value, suffix = '', delta, tone = 'primary', to }) => {
  const toneClasses = {
    primary: 'text-[var(--primary)] bg-[var(--primary)]/12',
    success: 'text-[var(--success)] bg-[var(--success)]/12',
    warning: 'text-[var(--warning)] bg-[var(--warning)]/12',
    error:   'text-[var(--error)] bg-[var(--error)]/12',
    accent:  'text-[var(--accent-blue)] bg-[var(--accent-blue)]/12',
  }[tone] || 'text-[var(--text-muted)] bg-[var(--bg)]';

  const showDelta = delta !== null && delta !== undefined && delta !== 0;
  const trendUp = (delta ?? 0) > 0;
  const trendColor = trendUp ? 'text-[var(--success)]' : 'text-[var(--error)]';

  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${toneClasses}`}>
          <Icon size={16} />
        </div>
        {showDelta && (
          <div className={`text-[10px] font-black ${trendColor}`}>
            {trendUp ? '▲' : '▼'} {Math.abs(delta)}
          </div>
        )}
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mt-3">
        {label}
      </p>
      <p className="text-2xl font-extrabold text-[var(--text-primary)] leading-tight mt-0.5 tabular-nums">
        {value}{suffix}
      </p>
    </>
  );

  const classes = `text-left w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 transition-all ${
    to ? 'hover:border-[var(--primary)]/40 hover:shadow-sm cursor-pointer' : ''
  }`;

  return to
    ? <Link to={to} className={classes}>{inner}</Link>
    : <div className={classes}>{inner}</div>;
};

const SectionCard = ({ title, icon: Icon, action, children }) => (
  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 h-full flex flex-col">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={15} className="text-[var(--primary)]" />}
        <h3 className="text-sm font-bold text-[var(--text-primary)]">{title}</h3>
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
  return (
    <SectionCard title="CRM Funnel" icon={Users}
      action={<Link to="/crm/dashboard" className="text-xs text-[var(--primary)] flex items-center gap-1 hover:underline">View CRM <ArrowRight size={11} /></Link>}>
      <div className="space-y-2">
        {data.map((row) => (
          <div key={row.stage} className="flex items-center gap-3">
            <div className="w-28 text-xs font-semibold text-[var(--text-secondary)] truncate">{row.stage}</div>
            <div className="flex-1 h-6 bg-[var(--bg)] rounded-md overflow-hidden relative">
              <div
                className="absolute inset-y-0 left-0 bg-[var(--primary)]/70 rounded-md transition-all"
                style={{ width: `${(row.count / maxCount) * 100}%` }}
              />
            </div>
            <div className="w-10 text-right text-sm font-bold text-[var(--text-primary)] tabular-nums">{row.count}</div>
          </div>
        ))}
        {!data.length && <p className="text-xs text-[var(--text-muted)]">No leads in window.</p>}
      </div>
    </SectionCard>
  );
};

const ProposalPipelineCard = ({ pipeline }) => {
  const rows = (pipeline?.byStatus || []).filter((r) => r.count > 0);
  return (
    <SectionCard title="Proposal Pipeline" icon={FileText}
      action={<Link to="/proposal" className="text-xs text-[var(--primary)] flex items-center gap-1 hover:underline">View Proposals <ArrowRight size={11} /></Link>}>
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
    <SectionCard title="Project Health" icon={Activity}
      action={<Link to="/pms/dashboard" className="text-xs text-[var(--primary)] flex items-center gap-1 hover:underline">View PMS <ArrowRight size={11} /></Link>}>
      {total === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">No active projects.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
              {data.map((d) => <Cell key={d.key} fill={HEALTH_COLOR[d.key]} />)}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </SectionCard>
  );
};

const ProfitabilityCard = ({ profitability }) => {
  const rows = profitability?.topVariance || [];
  return (
    <SectionCard title="Profitability — Top Variance" icon={Wallet}
      action={<Link to="/pms/analytics" className="text-xs text-[var(--primary)] flex items-center gap-1 hover:underline">Analytics <ArrowRight size={11} /></Link>}>
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
        {rows.map((r) => (
          <Link key={r.projectId} to={`/projects/${r.projectId}`} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-[var(--bg)] transition-colors">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{r.name}</p>
              <p className="text-[10px] text-[var(--text-muted)]">{r.trackingId} · {r.clientName}</p>
            </div>
            <div className="text-right ml-2">
              <p className={`text-xs font-bold tabular-nums ${r.variancePct >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                {r.variancePct}%
              </p>
              <p className="text-[10px] text-[var(--text-muted)] tabular-nums">{formatCurrency(r.variance)}</p>
            </div>
          </Link>
        ))}
      </div>
    </SectionCard>
  );
};

const WeeklyTrendCard = ({ trend }) => {
  const primary = cssVar('--primary', '#3A6EA5');
  const success = cssVar('--success', '#22c55e');
  const warning = cssVar('--warning', '#f59e0b');
  const accent  = cssVar('--accent-blue', '#0ea5e9');
  return (
    <SectionCard title="12-Week Activity Trend" icon={TrendingUp}>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={trend || []}>
          <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--border', '#e5e7eb')} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="leads"           name="Leads"            stroke={primary} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="proposalsSent"   name="Proposals Sent"   stroke={accent}  strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="advances"        name="Advances"         stroke={success} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="projectsStarted" name="Projects Started" stroke={warning} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
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
      <SectionCard title="Alerts" icon={CheckCircle2}>
        <p className="text-xs text-[var(--success)] flex items-center gap-1.5">
          <CheckCircle2 size={13} /> No critical alerts. All systems are healthy.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Alerts Rollup" icon={AlertTriangle}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <Link to="/pms/dashboard" className="bg-[var(--error)]/10 border border-[var(--error)]/30 rounded-lg p-2 text-center hover:bg-[var(--error)]/20 transition-colors">
          <p className="text-2xl font-extrabold text-[var(--error)] tabular-nums">{alerts?.delayedCount || 0}</p>
          <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase mt-0.5">Delayed</p>
        </Link>
        <Link to="/pms/analytics" className="bg-[var(--warning)]/10 border border-[var(--warning)]/30 rounded-lg p-2 text-center hover:bg-[var(--warning)]/20 transition-colors">
          <p className="text-2xl font-extrabold text-[var(--warning)] tabular-nums">{alerts?.openGates || 0}</p>
          <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase mt-0.5">Open Gates</p>
        </Link>
        <Link to="/pms/review-design" className="bg-[var(--accent-blue)]/10 border border-[var(--accent-blue)]/30 rounded-lg p-2 text-center hover:bg-[var(--accent-blue)]/20 transition-colors">
          <p className="text-2xl font-extrabold text-[var(--accent-blue)] tabular-nums">{alerts?.pendingPdReviews || 0}</p>
          <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase mt-0.5">PD Reviews</p>
        </Link>
        <Link to="/proposal/approval" className="bg-[var(--primary)]/10 border border-[var(--primary)]/30 rounded-lg p-2 text-center hover:bg-[var(--primary)]/20 transition-colors">
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

const MDDashboardPage = () => {
  const [period, setPeriod] = useState('month');
  const { data, isLoading, error, refresh } = useMDDashboard(period);

  const k = data?.executiveKpis || {};

  return (
    <div className="space-y-5">
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
