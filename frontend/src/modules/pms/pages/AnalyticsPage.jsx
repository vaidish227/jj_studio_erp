import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3, Lock, Clock, Users, ShoppingBag, IndianRupee, ArrowUpRight,
  TrendingUp, TrendingDown, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { Button, Loader } from '../../../shared/components';
import { useAuth } from '../../../shared/context/AuthContext';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';

/**
 * AnalyticsPage — Phase 4.
 *
 * MD/manager analytics. 5 widgets behind a tab switcher so each is full-width
 * and readable. All data is fetched lazily per tab.
 */

const TABS = [
  { id: 'gates',       label: 'Pending Sign-offs',    icon: Lock },
  { id: 'sla',         label: 'Release SLA',          icon: Clock },
  { id: 'designers',   label: 'Designer Utilisation', icon: Users },
  { id: 'vendors',     label: 'Vendor Performance',   icon: ShoppingBag },
  { id: 'profit',      label: 'Profitability',        icon: IndianRupee },
];

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

// ── Main page ────────────────────────────────────────────────────────────────
const AnalyticsPage = () => {
  const { hasPermission } = useAuth();
  const [active, setActive] = useState('gates');

  if (!hasPermission('reports.read')) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle size={20} className="mx-auto mb-2 text-[var(--warning)]" />
        <p className="text-sm text-[var(--text-muted)]">You need the <code>reports.read</code> permission to access analytics.</p>
      </div>
    );
  }

  const Panel =
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
