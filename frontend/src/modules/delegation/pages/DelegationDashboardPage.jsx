import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2, Clock, AlertTriangle, Eye, CheckCircle2, LayoutDashboard,
  Activity, BarChart3, TrendingUp, PieChart, Flag, Layers, PlayCircle,
  Target, Timer, CalendarClock, RefreshCw, Users, History, ChevronRight, HelpCircle,
} from 'lucide-react';
import KpiTile from '../../dashboard/components/common/KpiTile';
import { useDelegationDashboard } from '../hooks/useDelegationDashboard';
import { InitialsAvatar } from '../components/delegationVisuals';
import { relativeTime } from '../components/delegationFormat';
import MetricInfoTooltip from '../components/MetricInfoTooltip';
import { DELEGATION_HELP as HELP } from '../constants/delegationDashboardHelp';
import ChartCard from '../components/charts/ChartCard';
import ActivityTrendChart from '../components/charts/ActivityTrendChart';
import StatusMixDonut from '../components/charts/StatusMixDonut';
import PriorityBreakdown from '../components/charts/PriorityBreakdown';
import WorkloadChart from '../components/charts/WorkloadChart';
import AttentionList from '../components/charts/AttentionList';
import TopAssignees from '../components/charts/TopAssignees';
import AgingBuckets from '../components/charts/AgingBuckets';

// Compact metric chip for the secondary "summary" band — lighter weight than a
// KpiTile, so the pipeline counts stay the visual anchor.
const MiniStat = ({ icon: Icon, label, value, hint }) => (
  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-4 py-3 flex items-center gap-3">
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
      style={{ background: 'color-mix(in srgb, var(--primary) 12%, transparent)', color: 'var(--primary-active)' }}
    >
      <Icon size={16} />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
      <p className="text-lg font-extrabold text-[var(--text-primary)] leading-tight tabular-nums">
        {value}
        {hint && <span className="text-[11px] font-semibold text-[var(--text-muted)] ml-1">{hint}</span>}
      </p>
    </div>
  </div>
);

// Overlay-wrap a KPI tile / summary chip with a corner info icon. The `group`
// scopes the hover-reveal to this single card; `relative` anchors the floating
// icon without disturbing the tile's own layout (no reflow). Declared at module
// scope so it isn't re-created on every render.
const Hint = ({ help, guided, children }) => (
  <div className="group relative">
    {children}
    <MetricInfoTooltip help={help} overlay alwaysShow={guided} />
  </div>
);

const DelegationDashboardPage = () => {
  const {
    kpis, summary, statusMix, priorityMix, trend, workload,
    assignees, aging, attention, recentActivity,
    isLoading, error, refresh,
  } = useDelegationDashboard();

  // Guided Mode — OFF by default. When on, every info icon stays visible so a
  // first-time user can explore the whole dashboard at once.
  const [guided, setGuided] = useState(false);

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-black shadow-sm shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-active))' }}
        >
          <LayoutDashboard size={22} />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold text-[var(--text-primary)]">Delegation Dashboard</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">At-a-glance overview of delegated work.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setGuided((g) => !g)}
            aria-pressed={guided}
            title="Reveal an info icon on every card and chart"
            className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-xl px-3 py-2 border transition-colors ${
              guided
                ? 'text-black border-transparent'
                : 'text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg)]'
            }`}
            style={guided ? { background: 'linear-gradient(135deg, var(--primary), var(--primary-active))' } : undefined}
          >
            <HelpCircle size={14} />
            Dashboard Guide
          </button>
          <button
            type="button"
            onClick={refresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-xl px-3 py-2 hover:bg-[var(--bg)] transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-[var(--text-muted)]"><Loader2 className="animate-spin mr-2" />Loading…</div>
      ) : error ? (
        <div className="py-12 text-center text-[var(--error)] text-sm">{error}</div>
      ) : (
        <>
          {/* Pipeline KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <Hint help={HELP.active} guided={guided}><KpiTile icon={Layers} label="Active" value={summary.totalActive ?? 0} tone="accent" /></Hint>
            <Hint help={HELP.pending} guided={guided}><KpiTile icon={Clock} label="Pending" value={kpis.pending ?? 0} tone="primary" /></Hint>
            <Hint help={HELP.inProgress} guided={guided}><KpiTile icon={PlayCircle} label="In Progress" value={kpis.inProgress ?? 0} tone="teal" /></Hint>
            <Hint help={HELP.inReview} guided={guided}><KpiTile icon={Eye} label="In Review" value={kpis.inReview ?? 0} tone="warning" /></Hint>
            <Hint help={HELP.overdue} guided={guided}><KpiTile icon={AlertTriangle} label="Overdue" value={kpis.overdue ?? 0} tone="error" /></Hint>
            <Hint help={HELP.completed} guided={guided}><KpiTile icon={CheckCircle2} label="Completed" value={kpis.completed ?? 0} tone="success" /></Hint>
          </div>

          {/* Summary band */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Hint help={HELP.completionRate} guided={guided}>
              <MiniStat icon={Target} label="Completion Rate" value={`${summary.completionRate ?? 0}%`} />
            </Hint>
            <Hint help={HELP.avgCycleTime} guided={guided}>
              <MiniStat
                icon={Timer}
                label="Avg Cycle Time"
                value={summary.avgCycleDays != null ? summary.avgCycleDays : '—'}
                hint={summary.avgCycleDays != null ? 'days' : ''}
              />
            </Hint>
            <Hint help={HELP.onTimeDelivery} guided={guided}>
              <MiniStat
                icon={CheckCircle2}
                label="On-Time Delivery"
                value={summary.onTimeRate != null ? `${summary.onTimeRate}%` : '—'}
              />
            </Hint>
            <Hint help={HELP.dueSoon} guided={guided}>
              <MiniStat icon={CalendarClock} label="Due in 3 Days" value={summary.dueSoon ?? 0} />
            </Hint>
          </div>

          {/* Charts row — trend (wide) + status mix. Stretch so the trend chart
              fills to the donut+legend height instead of leaving a gap. */}
          <div className="grid lg:grid-cols-3 gap-4">
            <ChartCard
              icon={TrendingUp}
              title="Workload Trend"
              className="lg:col-span-2"
              info={HELP.workloadTrend}
              guided={guided}
              action={<span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Last 14 days</span>}
            >
              <ActivityTrendChart data={trend} />
            </ChartCard>

            <ChartCard icon={PieChart} title="Status Mix" info={HELP.statusMix} guided={guided}>
              <StatusMixDonut statusMix={statusMix} />
            </ChartCard>
          </div>

          {/* Attention required — full-width actionable worklist */}
          <ChartCard
            icon={AlertTriangle}
            title="Attention Required"
            info={HELP.attention}
            guided={guided}
            action={
              <Link to="/delegation/list" className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[var(--primary-active)] hover:underline">
                View all <ChevronRight size={13} />
              </Link>
            }
          >
            <AttentionList items={attention} />
          </ChartCard>

          {/* Breakdown tiles (uniform height) beside the activity feed.
              Fixed heights keep the rows balanced regardless of how sparse the
              data is — the left block (2 rows of h-52 + gap) equals the feed. */}
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
              <ChartCard icon={BarChart3} title="Department Workload" className="h-52" info={HELP.departmentWorkload} guided={guided}>
                <WorkloadChart workload={workload} />
              </ChartCard>

              <ChartCard icon={Users} title="Top Assignees" className="h-52" bodyClassName="overflow-y-auto min-h-0" info={HELP.topAssignees} guided={guided}>
                <TopAssignees assignees={assignees} />
              </ChartCard>

              <ChartCard icon={Flag} title="Priority (Open)" className="h-52" bodyClassName="overflow-y-auto min-h-0" info={HELP.priority} guided={guided}>
                <PriorityBreakdown priorityMix={priorityMix} />
              </ChartCard>

              <ChartCard icon={History} title="Aging (Open)" className="h-52" bodyClassName="overflow-y-auto min-h-0" info={HELP.aging} guided={guided}>
                <AgingBuckets aging={aging} />
              </ChartCard>
            </div>

            <ChartCard icon={Activity} title="Recent Activity" className="lg:h-[27rem]" bodyClassName="overflow-y-auto min-h-0 pr-1" info={HELP.recentActivity} guided={guided}>
              {recentActivity.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No recent activity.</p>
              ) : (
                <ul className="relative space-y-4">
                  {/* connector line */}
                  <span className="absolute left-[13px] top-2 bottom-2 w-px bg-[var(--border)]" aria-hidden />
                  {recentActivity.map((a) => (
                    <li key={a._id} className="relative flex gap-3">
                      <InitialsAvatar name={a.actorId?.name || ''} size={28} className="relative z-10 ring-2 ring-[var(--surface)]" />
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="text-xs text-[var(--text-secondary)] leading-snug">
                          <b className="text-[var(--text-primary)]">{a.actorId?.name || 'User'}</b> {a.description}
                        </p>
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5 flex items-center gap-1.5 flex-wrap">
                          {a.delegationId?.trackingId && (
                            <span className="font-mono bg-[var(--bg)] rounded px-1.5 py-0.5">{a.delegationId.trackingId}</span>
                          )}
                          <span>{relativeTime(a.createdAt)}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
};

export default DelegationDashboardPage;
