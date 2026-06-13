import React, { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Award, CheckCircle2, Clock, AlertTriangle, Activity,
  TrendingUp, ListChecks, Briefcase, Mail, Phone, Loader2, RefreshCw, FileDown,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';
import useDesignerDetail from '../hooks/useDesignerDetail';

const PERIOD_OPTIONS = [
  { value: 'week',    label: 'Last 7 Days' },
  { value: 'month',   label: 'Last 30 Days' },
  { value: 'quarter', label: 'Last 90 Days' },
  { value: 'all',     label: 'All Time' },
];

const STATUS_LABEL = {
  not_started:           'Not Started',
  in_progress:           'In Progress',
  blocked:               'Blocked',
  pending_review:        'Submitted',
  revision_requested:    'Revision',
  pending_client_approval: 'Pending Client',
  approved:              'Approved',
  released_to_site:      'Released',
  completed:             'Completed',
  on_hold:               'On Hold',
  unknown:               'Unknown',
};

const STATUS_COLOR = {
  not_started:        '#94a3b8',
  in_progress:        '#3b82f6',
  blocked:            '#ef4444',
  pending_review:     '#f59e0b',
  revision_requested: '#ef4444',
  pending_client_approval: '#f59e0b',
  approved:           '#10b981',
  released_to_site:   '#8b5cf6',
  completed:          '#22c55e',
  on_hold:            '#64748b',
  unknown:            '#cbd5e1',
};

const cssVar = (name, fallback = '#000') => {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
};

const StatCard = ({ icon: Icon, label, value, suffix, tone = 'default', sub }) => {
  const tones = {
    default: 'text-[var(--text-primary)]',
    success: 'text-[var(--success)]',
    warning: 'text-[var(--warning)]',
    danger:  'text-[var(--error)]',
    info:    'text-[var(--accent-blue)]',
    primary: 'text-[var(--primary)]',
  };
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={14} className={tones[tone]} />
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
      </div>
      <p className={`text-2xl font-extrabold tabular-nums ${tones[tone]}`}>
        {value}
        {suffix && <span className="text-sm font-bold text-[var(--text-muted)] ml-1">{suffix}</span>}
      </p>
      {sub && <p className="text-[10px] text-[var(--text-muted)] mt-1">{sub}</p>}
    </div>
  );
};

const ChartCard = ({ title, icon: Icon, children, action }) => (
  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 h-full flex flex-col">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={15} className="text-[var(--primary)]" />}
        <h3 className="text-sm font-bold text-[var(--text-primary)]">{title}</h3>
      </div>
      {action}
    </div>
    <div className="flex-1 min-h-0">
      {children}
    </div>
  </div>
);

const ChartTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-[var(--text-primary)] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-[var(--text-secondary)] flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
          {p.name}: <span className="font-bold text-[var(--text-primary)]">{formatter ? formatter(p.value) : (p.value ?? '—')}</span>
        </p>
      ))}
    </div>
  );
};

const DesignerDetailPage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [period, setPeriod] = useState('month');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const { data, isLoading, error, refresh } = useDesignerDetail(userId, period);

  // Downloads the server-rendered report card — same data as this page,
  // rendered as a fixed A4 PDF (see backend services/designerReportPdf.js).
  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const blob = await pmsService.downloadDesignerReportPdf(userId, period);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Designer-Report-${(data?.user?.name || 'designer').trim().replace(/\s+/g, '-')}-${period}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Designer report downloaded');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to download report');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const weeklyTrend = useMemo(() => (data?.trend?.weekly || []).map((w) => ({
    ...w,
    label: new Date(w.weekStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
  })), [data]);

  const monthlyTrend = data?.trend?.monthly || [];

  const radarData = useMemo(() => {
    const b = data?.kraBreakdown || {};
    return [
      { axis: 'On-Time',      value: b.onTime ?? 0,    fullMark: 100 },
      { axis: 'First Pass',   value: b.firstPass ?? 0, fullMark: 100 },
      { axis: 'Throughput',   value: b.throughput ?? 0,fullMark: 100 },
    ];
  }, [data]);

  const donutData = useMemo(() => (data?.statusDistribution || []).map((s) => ({
    name:  STATUS_LABEL[s.status] || s.status,
    value: s.count,
    color: STATUS_COLOR[s.status] || '#cbd5e1',
  })), [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="max-w-2xl mx-auto bg-[var(--error)]/10 border border-[var(--error)]/40 text-[var(--error)] rounded-xl p-4 text-sm">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const { user, currentStats, projects = [], recentTasks = [] } = data;

  // KRA tone: 0–2.5 danger, 2.5–4 warning, 4+ success
  const kraTone = currentStats.kraScore >= 4 ? 'success'
                : currentStats.kraScore >= 2.5 ? 'warning'
                : 'danger';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg)]"
            title="Back"
          >
            <ArrowLeft size={14} />
          </button>
          <div className="w-12 h-12 rounded-full bg-[var(--primary)]/12 text-[var(--primary)] flex items-center justify-center text-base font-extrabold uppercase shrink-0">
            {(user.name || '?').slice(0, 2)}
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-extrabold text-[var(--text-primary)] truncate">{user.name || '—'}</h1>
            <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)] mt-0.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)] font-bold uppercase tracking-wider">
                {user.role || '—'}
              </span>
              {user.email && (
                <span className="inline-flex items-center gap-1"><Mail size={11} />{user.email}</span>
              )}
              {user.phone && (
                <span className="inline-flex items-center gap-1"><Phone size={11} />{user.phone}</span>
              )}
            </div>
          </div>
        </div>
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
            onClick={refresh}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)]"
            title="Refresh"
          >
            <RefreshCw size={13} />
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)] disabled:opacity-50"
            title="Download PDF report"
          >
            {downloadingPdf ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
            PDF Report
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={Award}        label="KRA Score"     value={currentStats.kraScore}    suffix="/5" tone={kraTone} sub="0–5 composite" />
        <StatCard icon={CheckCircle2} label="On-Time"       value={currentStats.onTimePct}   suffix="%"  tone="success" sub="of completed" />
        <StatCard icon={TrendingUp}   label="First-Pass"    value={currentStats.firstPassPct}suffix="%"  tone="info"    sub="approved without revision" />
        <StatCard icon={Activity}     label="Delivered"     value={currentStats.throughput}              tone="primary" sub="in period" />
        <StatCard icon={ListChecks}   label="Active Tasks"  value={currentStats.active}                  tone="default" sub="currently open" />
        <StatCard icon={AlertTriangle}label="Overdue"       value={currentStats.delayedActive}           tone="danger"  sub="past due date" />
      </div>

      {/* Charts row 1 — OTD + FPA trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="On-Time Delivery — Last 12 Weeks" icon={CheckCircle2}>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={weeklyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--border', '#e5e7eb')} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: cssVar('--text-muted', '#94a3b8') }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: cssVar('--text-muted', '#94a3b8') }} />
                <Tooltip content={<ChartTooltip formatter={(v) => v == null ? '—' : `${v}%`} />} />
                <Line
                  type="monotone"
                  dataKey="onTimePct"
                  name="On-Time %"
                  stroke={cssVar('--success', '#22c55e')}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="First-Pass Approval — Last 12 Weeks" icon={TrendingUp}>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={weeklyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--border', '#e5e7eb')} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: cssVar('--text-muted', '#94a3b8') }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: cssVar('--text-muted', '#94a3b8') }} />
                <Tooltip content={<ChartTooltip formatter={(v) => v == null ? '—' : `${v}%`} />} />
                <Line
                  type="monotone"
                  dataKey="firstPassPct"
                  name="First-Pass %"
                  stroke={cssVar('--accent-blue', '#3b82f6')}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Charts row 2 — Monthly delivery + KRA radar + Status donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Monthly Delivery — Last 6 Months" icon={Activity}>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={monthlyTrend} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--border', '#e5e7eb')} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: cssVar('--text-muted', '#94a3b8') }} />
                <YAxis tick={{ fontSize: 10, fill: cssVar('--text-muted', '#94a3b8') }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="done" name="Tasks Delivered" fill={cssVar('--primary', '#d4b76c')} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="KRA Breakdown" icon={Award}>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid stroke={cssVar('--border', '#e5e7eb')} />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: cssVar('--text-secondary', '#475569'), fontWeight: 600 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: cssVar('--text-muted', '#94a3b8') }} />
                <Radar
                  name="Score"
                  dataKey="value"
                  stroke={cssVar('--primary', '#d4b76c')}
                  fill={cssVar('--primary', '#d4b76c')}
                  fillOpacity={0.35}
                />
                <Tooltip content={<ChartTooltip formatter={(v) => `${v}%`} />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Task Status Distribution" icon={ListChecks}>
          {donutData.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] text-center mt-10">No tasks in this window.</p>
          ) : (
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={40}
                    outerRadius={75}
                    paddingAngle={2}
                  >
                    {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 10, paddingTop: 6 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Tables row — Projects + Recent tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Briefcase size={15} className="text-[var(--primary)]" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Projects Assigned</h3>
            <span className="text-[10px] text-[var(--text-muted)]">{projects.length}</span>
          </div>
          {projects.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-6 text-center">No projects assigned in this window.</p>
          ) : (
            <div className="overflow-auto max-h-[420px]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 z-10 bg-[var(--surface)]">
                  <tr className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] border-b border-[var(--border)]">
                    <th className="py-2">Project</th>
                    <th className="py-2">Phase</th>
                    <th className="py-2 text-center">Active</th>
                    <th className="py-2 text-center">Done</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p._id} className="border-b border-[var(--border)]/60 last:border-0">
                      <td className="py-2">
                        <Link to={`/projects/${p._id}`} className="font-bold text-[var(--text-primary)] hover:text-[var(--primary)]">
                          {p.name}
                        </Link>
                        {p.trackingId && <p className="text-[10px] font-mono text-[var(--text-muted)]">{p.trackingId}</p>}
                      </td>
                      <td className="py-2 text-[var(--text-secondary)] capitalize">{p.phase || '—'}</td>
                      <td className="py-2 text-center tabular-nums">{p.tasks.active}</td>
                      <td className="py-2 text-center tabular-nums text-[var(--success)] font-bold">{p.tasks.done}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={15} className="text-[var(--primary)]" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Recent Tasks</h3>
            <span className="text-[10px] text-[var(--text-muted)]">last {recentTasks.length}</span>
          </div>
          {recentTasks.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-6 text-center">No recent activity.</p>
          ) : (
            <div className="overflow-auto max-h-[420px]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 z-10 bg-[var(--surface)]">
                  <tr className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] border-b border-[var(--border)]">
                    <th className="py-2">Task</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTasks.map((t) => (
                    <tr key={t._id} className="border-b border-[var(--border)]/60 last:border-0">
                      <td className="py-2">
                        <Link to={`/tasks/${t._id}`} className="font-bold text-[var(--text-primary)] hover:text-[var(--primary)]">
                          {t.title}
                        </Link>
                        <p className="text-[10px] text-[var(--text-muted)]">{t.projectName}</p>
                      </td>
                      <td className="py-2">
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                          style={{
                            background: `${STATUS_COLOR[t.status] || '#cbd5e1'}22`,
                            color:      STATUS_COLOR[t.status] || '#475569',
                          }}
                        >
                          {STATUS_LABEL[t.status] || t.status}
                        </span>
                      </td>
                      <td className="py-2 text-[var(--text-secondary)]">
                        {t.dueDate
                          ? <span className={t.isDelayed ? 'text-[var(--error)] font-bold' : ''}>
                              {new Date(t.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                            </span>
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DesignerDetailPage;
