import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Calendar } from 'lucide-react';

const DashboardCard = ({ dashboard }) => {
  const navigate = useNavigate();
  if (!dashboard) return null;

  return (
    <div className="bg-white border border-[var(--border,#e5e5e5)] rounded-lg px-3 py-2.5">
      <div className="grid grid-cols-3 gap-2 mb-2">
        <Stat label="Total" value={dashboard.totalAssigned} />
        <Stat label="Overdue" value={dashboard.overdueCount} accent={dashboard.overdueCount > 0 ? 'red' : null} />
        <Stat label="Projects" value={dashboard.activeProjects?.length ?? 0} />
      </div>

      {dashboard.byStatus && Object.keys(dashboard.byStatus).length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {Object.entries(dashboard.byStatus).map(([status, count]) => (
            <span key={status} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg,#F8F7F3)] text-[var(--text,#2E2E2E)]">
              {status.replace(/_/g, ' ')}: {count}
            </span>
          ))}
        </div>
      )}

      {dashboard.upcoming?.length > 0 && (
        <div className="mt-2">
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted,#A0A0A0)] mb-1">
            Upcoming
          </div>
          <div className="flex flex-col gap-1">
            {dashboard.upcoming.slice(0, 5).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => t.url && navigate(t.url)}
                className="text-left flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-[var(--bg,#F8F7F3)] transition-colors"
              >
                <Calendar className="w-3 h-3 text-[var(--text-muted,#A0A0A0)] flex-shrink-0" />
                <span className="flex-1 truncate text-[var(--text,#2E2E2E)]">{t.title}</span>
                <span className="text-[10px] text-[var(--text-muted,#A0A0A0)]">{t.project?.trackingId}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {dashboard.overdueCount > 0 && (
        <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-red-600">
          <AlertTriangle className="w-3 h-3" /> Resolve overdue first
        </div>
      )}
    </div>
  );
};

function Stat({ label, value, accent }) {
  const colorClass = accent === 'red' ? 'text-red-600' : 'text-[var(--text,#2E2E2E)]';
  return (
    <div className="bg-[var(--bg,#F8F7F3)] rounded px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted,#A0A0A0)]">{label}</div>
      <div className={`text-base font-semibold ${colorClass}`}>{value ?? 0}</div>
    </div>
  );
}

export default DashboardCard;
