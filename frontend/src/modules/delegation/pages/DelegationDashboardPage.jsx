import { Loader2, Clock, AlertTriangle, Eye, CheckCircle2, LayoutDashboard, Activity, BarChart3 } from 'lucide-react';
import KpiTile from '../../dashboard/components/common/KpiTile';
import { useDelegationDashboard } from '../hooks/useDelegationDashboard';
import { InitialsAvatar } from '../components/delegationVisuals';
import { relativeTime } from '../components/delegationFormat';

const DelegationDashboardPage = () => {
  const { kpis, workload, recentActivity, isLoading, error } = useDelegationDashboard();
  const maxWork = Math.max(1, ...workload.map((w) => w.count));

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
        <div>
          <h1 className="text-xl font-extrabold text-[var(--text-primary)]">Delegation Dashboard</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">At-a-glance overview of delegated work.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-[var(--text-muted)]"><Loader2 className="animate-spin mr-2" />Loading…</div>
      ) : error ? (
        <div className="py-12 text-center text-[var(--error)] text-sm">{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiTile icon={Clock} label="Pending" value={kpis.pending ?? 0} tone="primary" />
            <KpiTile icon={AlertTriangle} label="Overdue" value={kpis.overdue ?? 0} tone="error" />
            <KpiTile icon={Eye} label="In Review" value={kpis.inReview ?? 0} tone="warning" />
            <KpiTile icon={CheckCircle2} label="Completed" value={kpis.completed ?? 0} tone="success" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Workload */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
              <h3 className="text-sm font-extrabold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <BarChart3 size={16} className="text-[var(--primary-active)]" />
                Department Workload
              </h3>
              {workload.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No open delegations.</p>
              ) : (
                <div className="space-y-3.5">
                  {workload.map((w) => {
                    const color = w.color || 'var(--primary)';
                    return (
                      <div key={String(w.departmentId)} className="flex items-center gap-3 text-sm">
                        <span className="w-28 truncate text-[var(--text-secondary)] font-semibold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                          {w.name}
                        </span>
                        <div className="flex-1 h-2.5 bg-[var(--bg)] rounded-full overflow-hidden border border-[var(--border)]">
                          <div
                            className="h-full rounded-full transition-[width] duration-700 ease-out"
                            style={{ width: `${(w.count / maxWork) * 100}%`, background: color }}
                          />
                        </div>
                        <span className="w-8 text-right font-extrabold text-xs tabular-nums text-[var(--text-primary)]">{w.count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent activity — timeline */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
              <h3 className="text-sm font-extrabold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <Activity size={16} className="text-[var(--primary-active)]" />
                Recent Activity
              </h3>
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
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5 flex items-center gap-1.5">
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
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DelegationDashboardPage;
