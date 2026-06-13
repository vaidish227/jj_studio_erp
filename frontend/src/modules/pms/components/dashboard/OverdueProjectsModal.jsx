import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Clock, User as UserIcon } from 'lucide-react';
import Modal from '../../../../shared/components/Modal/Modal';
import { Button } from '../../../../shared/components';

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—';

const daysAgo = (d) => {
  if (!d) return 0;
  const ms = Date.now() - new Date(d).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
};

/**
 * OverdueProjectsModal — opens when MD clicks "Review Now" on the dashboard's
 * red banner. Lists each delayed project with blocker attribution and quick
 * navigation to the project page or its Tasks tab.
 */
const OverdueProjectsModal = ({ isOpen, onClose, projects = [] }) => {
  const navigate = useNavigate();

  const openProject = (projectId, withTasksTab = false) => {
    if (!projectId) return;
    onClose?.();
    navigate(withTasksTab ? `/projects/${projectId}?tab=tasks` : `/projects/${projectId}`);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Delayed Projects (${projects.length})`}
      className="max-w-3xl"
    >
      {projects.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <AlertTriangle size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No delayed projects right now — all on track.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map((p) => {
            const oldest = (p.blockers || [])
              .map((b) => b.oldestDueDate)
              .filter(Boolean)
              .sort((a, b) => new Date(a) - new Date(b))[0];
            const oldestTitle = (p.blockers || [])
              .find((b) => b.oldestDueDate && new Date(b.oldestDueDate).getTime() === new Date(oldest).getTime())
              ?.oldestTaskTitle;

            return (
              <div
                key={p._id}
                className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/40 px-4 py-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                        {p.trackingId}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--error)]/15 text-[var(--error)] text-[10px] font-black uppercase">
                        <Clock size={10} /> {p.daysLate}d late
                      </span>
                    </div>
                    <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5 truncate">
                      {p.name}
                    </p>
                    {p.clientName && (
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                        Client: {p.clientName}
                      </p>
                    )}
                  </div>
                </div>

                {(p.blockers && p.blockers.length > 0) && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.blockers.map((b) => (
                      <span
                        key={b.userId}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--error)]/8 border border-[var(--error)]/20 text-[11px]"
                      >
                        <UserIcon size={11} className="text-[var(--error)]" />
                        <span className="font-bold text-[var(--text-primary)]">{b.name}</span>
                        {b.responsibility && (
                          <span className="text-[var(--text-muted)]">— {b.responsibility}</span>
                        )}
                        <span className="font-black text-[var(--error)]">
                          · {b.overdueTaskCount} overdue
                        </span>
                      </span>
                    ))}
                  </div>
                )}

                {oldest && (
                  <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                    Oldest blocked task:{' '}
                    <span className="font-semibold text-[var(--text-secondary)]">
                      {oldestTitle || 'Task'}
                    </span>{' '}
                    ({daysAgo(oldest)}d overdue, due {fmtDate(oldest)})
                  </p>
                )}

                {(!p.blockers || p.blockers.length === 0) && p.overdueTaskCount > 0 && (
                  <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                    {p.overdueTaskCount} overdue task{p.overdueTaskCount === 1 ? '' : 's'} on this project.
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => openProject(p._id, false)}
                  >
                    Open Project <ArrowRight size={12} className="ml-1" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => openProject(p._id, true)}
                  >
                    View Overdue Tasks
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
};

export default OverdueProjectsModal;
