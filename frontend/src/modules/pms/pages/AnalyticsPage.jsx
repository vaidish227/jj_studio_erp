import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3, Lock, Clock, Users, ShoppingBag, IndianRupee, ArrowUpRight,
  TrendingUp, TrendingDown, AlertTriangle, RefreshCw, Activity,
  FileSpreadsheet, Download,
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar as RBar, XAxis, YAxis, CartesianGrid, LineChart, Line,
} from 'recharts';
import { Button, Loader } from '../../../shared/components';
import { useAuth } from '../../../shared/context/AuthContext';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { exportReportAsExcel } from '../../../shared/utils/excelExport';

/**
 * AnalyticsPage — Phase 4.
 *
 * MD/manager analytics. 5 widgets behind a tab switcher so each is full-width
 * and readable. All data is fetched lazily per tab.
 */

const TABS = [
  { id: 'overview',    label: 'Project Overview',     icon: Activity },
  { id: 'gates',       label: 'Pending Sign-offs',    icon: Lock },
  { id: 'sla',         label: 'Release SLA',          icon: Clock },
  { id: 'designers',   label: 'Designer Utilisation', icon: Users },
  { id: 'vendors',     label: 'Vendor Performance',   icon: ShoppingBag },
  { id: 'profit',      label: 'Profitability',        icon: IndianRupee },
];

// ── Shared chart helpers ─────────────────────────────────────────────────────
const cssVar = (name, fallback = '#000') => {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
};

const PROJECT_STATUS_COLOR = {
  new:              '#94a3b8',
  design_phase:     '#3b82f6',
  execution_phase:  '#8b5cf6',
  on_hold:          '#64748b',
  completed:        '#22c55e',
  cancelled:        '#ef4444',
};
const PROJECT_STATUS_LABEL = {
  new:              'New',
  design_phase:     'Design',
  execution_phase:  'Execution',
  on_hold:          'On Hold',
  completed:        'Completed',
  cancelled:        'Cancelled',
};
const HEALTH_COLOR = {
  on_track: '#22c55e',
  at_risk:  '#f59e0b',
  blocked:  '#ef4444',
  on_hold:  '#64748b',
  delayed:  '#7c2d12',
};
const HEALTH_LABEL = {
  on_track: 'On Track', at_risk: 'At Risk', blocked: 'Blocked', on_hold: 'On Hold', delayed: 'Delayed',
};
const PHASE_LABEL = {
  kickoff: 'Kickoff', layout: 'Layout', design: 'Design', procurement: 'Procurement',
  release: 'Release', execution: 'Execution', handover: 'Handover',
};

const SimpleTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-bold text-[var(--text-primary)] mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-[var(--text-secondary)] flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
          {p.name}: <span className="font-bold text-[var(--text-primary)]">{p.value ?? '—'}</span>
        </p>
      ))}
    </div>
  );
};

const fmtINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtHours = (h) => {
  if (!h || h <= 0) return '—';
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
};

// Bar component for in-card mini charts
const Bar = ({ value, max, color = 'var(--primary)' }) => {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden w-full">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
};

// ── 1. Gate Aging ────────────────────────────────────────────────────────────
const GateAgingPanel = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    pmsService.getGateAging()
      .then((res) => setData(res))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PanelLoader />;
  if (!data || data.total === 0) return <EmptyPanel icon={<Lock size={28} />} msg="No pending sign-offs across projects." />;

  return (
    <div className="space-y-5">
      <SummaryRow>
        <Stat label="Pending sign-offs" value={data.total} />
        <Stat label="0–3 days" value={data.buckets['0-3']} tone="success" />
        <Stat label="4–7 days" value={data.buckets['4-7']} tone="accent" />
        <Stat label="8–14 days" value={data.buckets['8-14']} tone="warning" />
        <Stat label="15+ days" value={data.buckets['15+']} tone="error" />
      </SummaryRow>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg)] text-[var(--text-muted)]">
            <tr>
              <Th>Project</Th>
              <Th>Sign-off</Th>
              <Th>Approver</Th>
              <Th right>Age</Th>
              <Th right>Action</Th>
            </tr>
          </thead>
          <tbody>
            {data.gates.map((g) => (
              <tr key={g._id} className="border-t border-[var(--border)] hover:bg-[var(--bg)]/60">
                <Td>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mr-2">{g.trackingId}</span>
                  <span className="text-[var(--text-primary)] font-semibold">{g.projectName}</span>
                </Td>
                <Td>{g.label}</Td>
                <Td><ApproverBadge type={g.approverType} /></Td>
                <Td right>
                  <span className={`font-bold ${g.ageingDays > 14 ? 'text-[var(--error)]' : g.ageingDays > 7 ? 'text-[var(--warning)]' : 'text-[var(--text-primary)]'}`}>
                    {g.ageingDays}d
                  </span>
                </Td>
                <Td right>
                  <button
                    onClick={() => navigate(`/projects/${g.projectId}`)}
                    className="inline-flex items-center gap-0.5 text-xs font-semibold text-[var(--primary)] hover:underline"
                  >
                    Open <ArrowUpRight size={11} />
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── 2. Release SLA ───────────────────────────────────────────────────────────
const ReleaseSLAPanel = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pmsService.getDrawingReleaseSLA()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PanelLoader />;
  if (!data || data.total === 0) return <EmptyPanel icon={<Clock size={28} />} msg="No drawings released yet." />;

  const maxByType = Math.max(...data.byType.map((t) => t.avgHours), 1);

  return (
    <div className="space-y-5">
      <SummaryRow>
        <Stat label="Releases" value={data.total} />
        <Stat label="Avg time" value={fmtHours(data.avgHours)} tone="accent" />
        <Stat label="Median" value={fmtHours(data.medianHours)} />
        <Stat label="Slowest" value={fmtHours(data.maxHours)} tone="warning" />
        <Stat label="Fastest" value={fmtHours(data.minHours)} tone="success" />
      </SummaryRow>

      {/* By drawing type */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 lg:p-5">
        <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-4">By drawing type</h3>
        <div className="space-y-3">
          {data.byType.sort((a, b) => b.avgHours - a.avgHours).map((t) => (
            <div key={t.type} className="space-y-1">
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-semibold text-[var(--text-primary)]">{t.type}</span>
                <span className="text-[var(--text-muted)]">
                  {t.count} release{t.count === 1 ? '' : 's'} · avg {fmtHours(t.avgHours)} · median {fmtHours(t.medianHours)}
                </span>
              </div>
              <Bar value={t.avgHours} max={maxByType} />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg)] text-[var(--text-muted)]">
            <tr>
              <Th>Drawing</Th>
              <Th>Project</Th>
              <Th>Type</Th>
              <Th right>SLA</Th>
            </tr>
          </thead>
          <tbody>
            {data.recent.map((d) => (
              <tr key={d._id} className="border-t border-[var(--border)]">
                <Td>{d.title}</Td>
                <Td>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mr-1">{d.projectId?.trackingId}</span>
                  {d.projectId?.name}
                </Td>
                <Td>{d.drawingType}</Td>
                <Td right>
                  <span className={`font-bold ${d.slaHours > 24 ? 'text-[var(--warning)]' : 'text-[var(--text-primary)]'}`}>
                    {fmtHours(d.slaHours)}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── 3. Designer Utilisation ──────────────────────────────────────────────────
const DesignerUtilisationPanel = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pmsService.getDesignerUtilisation()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PanelLoader />;
  if (!data || !data.designers.length) return <EmptyPanel icon={<Users size={28} />} msg="No assigned tasks yet." />;

  const maxTotal = Math.max(...data.designers.map((d) => d.total), 1);

  return (
    <div className="space-y-5">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg)] text-[var(--text-muted)]">
            <tr>
              <Th>Designer</Th>
              <Th>Role</Th>
              <Th right>Total</Th>
              <Th right>Done</Th>
              <Th right>In Progress</Th>
              <Th right>Blocked</Th>
              <Th right>Completion</Th>
              <Th right>Avg cycle</Th>
            </tr>
          </thead>
          <tbody>
            {data.designers.map((d) => (
              <tr key={d.userId} className="border-t border-[var(--border)] hover:bg-[var(--bg)]/60">
                <Td>
                  <div className="font-semibold text-[var(--text-primary)]">{d.name}</div>
                  <div className="mt-1.5 w-20"><Bar value={d.total} max={maxTotal} /></div>
                </Td>
                <Td className="capitalize">{d.role}</Td>
                <Td right className="font-bold">{d.total}</Td>
                <Td right className="text-[var(--success)] font-bold">{d.completed}</Td>
                <Td right>{d.inProgress}</Td>
                <Td right>
                  {d.blocked > 0 ? <span className="text-[var(--warning)] font-bold">{d.blocked}</span> : '—'}
                </Td>
                <Td right>
                  <span className={`font-bold ${
                    d.completionRate >= 80 ? 'text-[var(--success)]' :
                    d.completionRate >= 50 ? 'text-[var(--text-primary)]' :
                    'text-[var(--warning)]'
                  }`}>
                    {d.completionRate}%
                  </span>
                </Td>
                <Td right>{fmtHours(d.avgCycleHours)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── 4. Vendor Performance ────────────────────────────────────────────────────
const VendorPerformancePanel = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pmsService.getVendorPerformance()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PanelLoader />;
  if (!data || !data.vendors.length) return <EmptyPanel icon={<ShoppingBag size={28} />} msg="No vendor engagements yet." />;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[var(--bg)] text-[var(--text-muted)]">
          <tr>
            <Th>Vendor</Th>
            <Th>Category</Th>
            <Th right>Total</Th>
            <Th right>Active</Th>
            <Th right>Delivered</Th>
            <Th right>Success</Th>
            <Th right>Avg quote</Th>
            <Th right>Avg PO</Th>
            <Th right>Avg delivery</Th>
          </tr>
        </thead>
        <tbody>
          {data.vendors.map((v) => (
            <tr key={v.vendorId} className="border-t border-[var(--border)] hover:bg-[var(--bg)]/60">
              <Td>
                <div className="font-semibold text-[var(--text-primary)]">{v.name}</div>
                {v.rating != null && (
                  <div className="text-[10px] text-[var(--text-muted)]">★ {v.rating}/5</div>
                )}
              </Td>
              <Td>{v.category}</Td>
              <Td right className="font-bold">{v.total}</Td>
              <Td right>{v.active}</Td>
              <Td right className="text-[var(--success)] font-bold">{v.delivered}</Td>
              <Td right>
                <span className={`font-bold ${
                  v.successRate >= 80 ? 'text-[var(--success)]' :
                  v.successRate >= 50 ? 'text-[var(--text-primary)]' :
                  'text-[var(--warning)]'
                }`}>
                  {v.successRate}%
                </span>
              </Td>
              <Td right>{fmtHours(v.avgQuoteHours)}</Td>
              <Td right>{fmtHours(v.avgPOHours)}</Td>
              <Td right>{fmtHours(v.avgDeliveryHours)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── 5. Project Profitability ─────────────────────────────────────────────────
const ProfitabilityPanel = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pmsService.getProjectProfitability()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PanelLoader />;
  if (!data || !data.projects.length) return <EmptyPanel icon={<IndianRupee size={28} />} msg="No projects with budget data yet." />;

  return (
    <div className="space-y-5">
      <SummaryRow>
        <Stat label="Total budget"  value={fmtINR(data.totals.budget)} />
        <Stat label="Total spend"   value={fmtINR(data.totals.spend)} tone="accent" />
        <Stat
          label="Variance"
          value={`${fmtINR(Math.abs(data.totals.variance))}${data.totals.variance < 0 ? ' over' : ''}`}
          tone={data.totals.variance < 0 ? 'error' : 'success'}
        />
        <Stat label="Over budget" value={data.totals.overBudgetCount} tone="warning" />
      </SummaryRow>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg)] text-[var(--text-muted)]">
            <tr>
              <Th>Project</Th>
              <Th>Client</Th>
              <Th>Phase</Th>
              <Th right>Budget</Th>
              <Th right>PO spend</Th>
              <Th right>Variance</Th>
              <Th right>POs</Th>
            </tr>
          </thead>
          <tbody>
            {data.projects.map((p) => (
              <tr key={p.projectId} className={`border-t border-[var(--border)] hover:bg-[var(--bg)]/60 ${p.overBudget ? 'bg-[var(--error)]/4' : ''}`}>
                <Td>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mr-1">{p.trackingId}</span>
                  <span className="text-[var(--text-primary)] font-semibold">{p.name}</span>
                </Td>
                <Td>{p.clientName}</Td>
                <Td className="capitalize">{p.phase || '—'}</Td>
                <Td right>{p.budget > 0 ? fmtINR(p.budget) : '—'}</Td>
                <Td right>{fmtINR(p.spend)}</Td>
                <Td right>
                  {p.budget > 0 ? (
                    <span className={`font-bold inline-flex items-center gap-0.5
                      ${p.overBudget ? 'text-[var(--error)]' : 'text-[var(--success)]'}`}>
                      {p.overBudget ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
                      {p.overBudget ? '-' : '+'}{Math.abs(p.variancePct)}%
                    </span>
                  ) : '—'}
                </Td>
                <Td right>{p.poCount}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Small primitives ─────────────────────────────────────────────────────────
const Th = ({ children, right }) => (
  <th className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-widest ${right ? 'text-right' : 'text-left'}`}>{children}</th>
);
const Td = ({ children, right, className = '' }) => (
  <td className={`px-4 py-2.5 text-xs ${right ? 'text-right' : 'text-left'} ${className}`}>{children}</td>
);
const Stat = ({ label, value, tone }) => {
  const toneCls =
    tone === 'success' ? 'text-[var(--success)]' :
    tone === 'warning' ? 'text-[var(--warning)]' :
    tone === 'error'   ? 'text-[var(--error)]'   :
    tone === 'accent'  ? 'text-[var(--accent-blue)]' :
    'text-[var(--text-primary)]';
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3 lg:p-4 flex-1 min-w-[120px]">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
      <p className={`mt-1 text-xl lg:text-2xl font-black ${toneCls}`}>{value}</p>
    </div>
  );
};
const SummaryRow = ({ children }) => (
  <div className="flex flex-wrap gap-3">{children}</div>
);
const PanelLoader = () => (
  <div className="flex items-center justify-center min-h-[40vh]"><Loader /></div>
);
const EmptyPanel = ({ icon, msg }) => (
  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-10 text-center space-y-2">
    <div className="text-[var(--text-muted)] opacity-60 inline-block">{icon}</div>
    <p className="text-sm text-[var(--text-muted)]">{msg}</p>
  </div>
);
const ApproverBadge = ({ type }) => {
  const cls =
    type === 'client'               ? 'bg-[var(--accent-blue)]/12 text-[var(--accent-blue)]' :
    type === 'principal_designer'   ? 'bg-[var(--primary)]/12 text-[var(--primary)]' :
    type === 'principal_and_client' ? 'bg-[var(--warning)]/12 text-[var(--warning)]' :
    'bg-[var(--text-muted)]/12 text-[var(--text-muted)]';
  return <span className={`text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${cls}`}>{type?.replace('_', ' ')}</span>;
};

// ── Project Overview (Phase B) ───────────────────────────────────────────────
const PERIOD_OPTIONS = [
  { value: 'week',    label: 'Last 7 Days' },
  { value: 'month',   label: 'Last 30 Days' },
  { value: 'quarter', label: 'Last 90 Days' },
  { value: 'all',     label: 'All Time' },
];

const ProjectOverviewPanel = () => {
  const toast = useToast();
  const [period, setPeriod] = useState('month');
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    pmsService.getProjectAnalytics(period)
      .then((res) => { if (!cancelled) setData(res || null); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period]);

  const downloadDesignerKpi = async () => {
    setDownloading('kpi');
    try {
      const res = await pmsService.getDesignerKpiReport(period);
      exportReportAsExcel(res, {
        fileName: `designer-kpi-${period}`,
        columns: [
          { header: 'Name',           key: 'name',          width: 22 },
          { header: 'Role',           key: 'role',          width: 14 },
          { header: 'Email',          key: 'email',         width: 26 },
          { header: 'Active Tasks',   key: 'activeTasks',   width: 12 },
          { header: 'Overdue Active', key: 'overdueActive', width: 14 },
          { header: 'Delivered',      key: 'delivered',     width: 11 },
          { header: 'On-Time %',      key: 'onTimePct',     width: 11 },
          { header: 'First-Pass %',   key: 'firstPassPct',  width: 12 },
          { header: 'KRA Score',      key: 'kraScore',      width: 11 },
        ],
      });
      toast.success('Designer KPI report downloaded');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to download');
    } finally { setDownloading(null); }
  };

  const downloadProjectSummary = async () => {
    setDownloading('projects');
    try {
      const res = await pmsService.getProjectSummaryReport(period);
      exportReportAsExcel(res, {
        fileName: `project-summary-${period}`,
        columns: [
          { header: 'Tracking ID',  key: 'trackingId',   width: 16 },
          { header: 'Name',         key: 'name',         width: 30 },
          { header: 'Status',       key: 'status',       width: 14 },
          { header: 'Phase',        key: 'phase',        width: 12 },
          { header: 'Health',       key: 'health',       width: 11 },
          { header: 'Progress %',   key: 'progressPct',  width: 11 },
          { header: 'Start Date',   key: 'startDate',    width: 12 },
          { header: 'ETA',          key: 'eta',          width: 12 },
          { header: 'Days to ETA',  key: 'daysToDeadline', width: 12 },
          { header: 'Delayed',      key: 'isDelayed',    width: 10 },
          { header: 'Tasks Total',  key: 'tasksTotal',   width: 12 },
          { header: 'Tasks Done',   key: 'tasksDone',    width: 11 },
          { header: 'Tasks Active', key: 'tasksActive',  width: 12 },
          { header: 'Tasks Overdue',key: 'tasksOverdue', width: 13 },
          { header: 'Open Gates',   key: 'openGates',    width: 11 },
        ],
      });
      toast.success('Project summary downloaded');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to download');
    } finally { setDownloading(null); }
  };

  if (loading) return <PanelLoader />;
  if (!data) return <EmptyPanel icon={<Activity size={28} />} msg="No analytics data available." />;

  const statusData = (data.statusDistribution || [])
    .filter((d) => d.count > 0)
    .map((d) => ({ name: PROJECT_STATUS_LABEL[d.status] || d.status, value: d.count, color: PROJECT_STATUS_COLOR[d.status] || '#94a3b8' }));
  const healthData = (data.healthDistribution || [])
    .filter((d) => d.count > 0)
    .map((d) => ({ name: HEALTH_LABEL[d.health] || d.health, value: d.count, color: HEALTH_COLOR[d.health] || '#94a3b8' }));
  const phaseData  = (data.phaseDistribution || [])
    .map((d) => ({ phase: PHASE_LABEL[d.phase] || d.phase, count: d.count }));

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <SummaryRow>
          <Stat label="Total Projects"  value={data.totals?.projects ?? 0} />
          <Stat label="Active"          value={data.totals?.activeProjects ?? 0} tone="info" />
          <Stat label="Completed"       value={data.totals?.completedProjects ?? 0} tone="success" />
          <Stat label="Designers Active" value={data.totals?.designersActive ?? 0} tone="primary" />
        </SummaryRow>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--primary)]"
          >
            {PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button
            type="button"
            onClick={downloadDesignerKpi}
            disabled={downloading === 'kpi'}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)] disabled:opacity-50"
          >
            <FileSpreadsheet size={13} /> {downloading === 'kpi' ? '…' : 'Designer KPI'}
          </button>
          <button
            type="button"
            onClick={downloadProjectSummary}
            disabled={downloading === 'projects'}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)] disabled:opacity-50"
          >
            <Download size={13} /> {downloading === 'projects' ? '…' : 'Project Summary'}
          </button>
        </div>
      </div>

      {/* Donut row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">Projects by Status</h3>
          {statusData.length === 0
            ? <p className="text-xs text-[var(--text-muted)] py-10 text-center">No projects.</p>
            : (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={90} paddingAngle={2}>
                      {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip content={<SimpleTooltip />} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">Active Projects by Health</h3>
          {healthData.length === 0
            ? <p className="text-xs text-[var(--text-muted)] py-10 text-center">No active projects.</p>
            : (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={healthData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={90} paddingAngle={2}>
                      {healthData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip content={<SimpleTooltip />} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
        </div>
      </div>

      {/* Phase distribution + delayed-per-project */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">Active Projects by Phase</h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={phaseData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--border', '#e5e7eb')} />
                <XAxis dataKey="phase" tick={{ fontSize: 10, fill: cssVar('--text-muted', '#94a3b8') }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: cssVar('--text-muted', '#94a3b8') }} />
                <Tooltip content={<SimpleTooltip />} cursor={{ fill: 'transparent' }} />
                <RBar dataKey="count" name="Projects" fill={cssVar('--primary', '#d4b76c')} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">Top Delayed — Overdue Tasks per Project</h3>
          {(!data.delayedPerProject || data.delayedPerProject.length === 0)
            ? <p className="text-xs text-[var(--text-muted)] py-10 text-center">No projects with overdue tasks.</p>
            : (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart
                    data={data.delayedPerProject}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--border', '#e5e7eb')} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: cssVar('--text-muted', '#94a3b8') }} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: cssVar('--text-muted', '#94a3b8') }} width={120} />
                    <Tooltip content={<SimpleTooltip />} cursor={{ fill: 'transparent' }} />
                    <RBar dataKey="count" name="Overdue Tasks" fill={cssVar('--error', '#ef4444')} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
        </div>
      </div>

      {/* Trend line + designer leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">Activity Trend — Last 12 Weeks</h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={data.activeTrend || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--border', '#e5e7eb')} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: cssVar('--text-muted', '#94a3b8') }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: cssVar('--text-muted', '#94a3b8') }} />
                <Tooltip content={<SimpleTooltip />} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
                <Line type="monotone" dataKey="newProjects"  name="New Projects"   stroke={cssVar('--primary', '#d4b76c')} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="tasksDone"    name="Tasks Done"     stroke={cssVar('--success', '#22c55e')} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="tasksDelayed" name="Tasks Delayed"  stroke={cssVar('--error', '#ef4444')}   strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">Designer Leaderboard — KRA Score</h3>
          {(!data.designerLeaderboard?.top || data.designerLeaderboard.top.length === 0)
            ? <p className="text-xs text-[var(--text-muted)] py-10 text-center">No designer activity in this period.</p>
            : (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart
                    data={data.designerLeaderboard.top}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--border', '#e5e7eb')} />
                    <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 10, fill: cssVar('--text-muted', '#94a3b8') }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: cssVar('--text-muted', '#94a3b8') }} width={120} />
                    <Tooltip content={<SimpleTooltip />} cursor={{ fill: 'transparent' }} />
                    <RBar dataKey="kraScore" name="KRA Score" fill={cssVar('--primary', '#d4b76c')} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

// ── Main page ────────────────────────────────────────────────────────────────
const AnalyticsPage = () => {
  const { hasPermission } = useAuth();
  const [active, setActive] = useState('overview');

  if (!hasPermission('reports.read')) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle size={20} className="mx-auto mb-2 text-[var(--warning)]" />
        <p className="text-sm text-[var(--text-muted)]">You need the <code>reports.read</code> permission to access analytics.</p>
      </div>
    );
  }

  const Panel =
    active === 'overview'  ? ProjectOverviewPanel :
    active === 'gates'     ? GateAgingPanel    :
    active === 'sla'       ? ReleaseSLAPanel   :
    active === 'designers' ? DesignerUtilisationPanel :
    active === 'vendors'   ? VendorPerformancePanel :
    ProfitabilityPanel;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <BarChart3 size={20} className="text-[var(--primary)]" />
          <h1 className="text-xl lg:text-2xl font-extrabold text-[var(--text-primary)]">PMS Analytics</h1>
        </div>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Cross-project workflow insight. All read-only.
        </p>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--border)] scrollbar-hide">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors
                ${isActive
                  ? 'border-[var(--primary)] text-[var(--primary)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
            >
              <Icon size={13} /> {t.label}
            </button>
          );
        })}
      </div>

      <Panel />
    </div>
  );
};

export default AnalyticsPage;
