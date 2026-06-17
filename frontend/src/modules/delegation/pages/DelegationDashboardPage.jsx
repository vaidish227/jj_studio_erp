import { Loader2, Clock, AlertTriangle, Eye, CheckCircle2 } from 'lucide-react';
import KpiTile from '../../dashboard/components/common/KpiTile';
import { useDelegationDashboard } from '../hooks/useDelegationDashboard';

const fmt = (d) => (d ? new Date(d).toLocaleString() : '');

const DelegationDashboardPage = () => {
  const { kpis, workload, recentActivity, isLoading, error } = useDelegationDashboard();
  const maxWork = Math.max(1, ...workload.map((w) => w.count));

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-[var(--text-primary)]">Delegation Dashboard</h1>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">At-a-glance overview of delegated work.</p>
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
              <h3 className="text-sm font-extrabold text-[var(--text-primary)] mb-4">Department Workload</h3>
              {workload.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No open delegations.</p>
              ) : (
                <div className="space-y-3">
                  {workload.map((w) => (
                    <div key={String(w.departmentId)} className="flex items-center gap-3 text-sm">
                      <span className="w-28 truncate text-[var(--text-secondary)] font-semibold">{w.name}</span>
                      <div className="flex-1 h-3 bg-[var(--bg)] rounded-full overflow-hidden border border-[var(--border)]">
                        <div className="h-full rounded-full" style={{ width: `${(w.count / maxWork) * 100}%`, background: w.color || 'var(--primary)' }} />
                      </div>
                      <span className="w-8 text-right font-bold text-xs">{w.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent activity */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
              <h3 className="text-sm font-extrabold text-[var(--text-primary)] mb-4">Recent Activity</h3>
              {recentActivity.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No recent activity.</p>
              ) : (
                <ul className="space-y-2.5">
                  {recentActivity.map((a) => (
                    <li key={a._id} className="text-xs text-[var(--text-secondary)]">
                      <b>{a.actorId?.name || 'User'}</b> — {a.description}
                      {a.delegationId?.trackingId && <span className="text-[var(--text-muted)]"> · {a.delegationId.trackingId}</span>}
                      <div className="text-[10px] text-[var(--text-muted)]">{fmt(a.createdAt)}</div>
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
