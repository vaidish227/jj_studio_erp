import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Clock, User as UserIcon, X } from 'lucide-react';
import { Button } from '../../../shared/components';

const TASK_DONE = new Set(['approved', 'released_to_site', 'completed', 'done']);

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—';

/**
 * ProjectDelayBanner — single-project variant of the dashboard's overdue
 * banner. Shown on the Project Detail page when the project is past its ETA
 * OR has at least one overdue task.
 *
 * Blockers are derived client-side from the already-loaded `tasks` array so
 * no extra API call is needed.
 */
const ProjectDelayBanner = ({ project, overdueTasks = [], onViewTasks }) => {
  const [dismissed, setDismissed] = useState(false);
  const eta = project?.estimatedCompletionDate;

  // Render-time math — banner is short-lived UI; no need to memoise.
  let daysLate = 0;
  if (eta) {
    const ms = Date.now() - new Date(eta).getTime();
    if (ms > 0) daysLate = Math.max(1, Math.floor(ms / 86400000));
  }

  // Group overdue tasks by assignee (handles populated object OR raw ObjectId).
  const blockers = useMemo(() => {
    const byUser = new Map();
    for (const t of overdueTasks) {
      if (TASK_DONE.has(t.status)) continue;
      const u = t.assignedTo;
      if (!u) continue;
      const uid = typeof u === 'string' ? u : String(u._id || u);
      const name = (typeof u === 'object' && u?.name) || 'Unassigned';
      if (!byUser.has(uid)) {
        byUser.set(uid, { name, count: 0, oldestDueDate: t.dueDate, oldestTitle: t.title });
      }
      const agg = byUser.get(uid);
      agg.count++;
      if (t.dueDate && new Date(t.dueDate) < new Date(agg.oldestDueDate || Infinity)) {
        agg.oldestDueDate = t.dueDate;
        agg.oldestTitle   = t.title;
      }
    }
    return [...byUser.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [overdueTasks]);

  // Only surface this loud banner when the project is genuinely at risk —
  // the project itself is past its deadline, OR enough tasks have slipped
  // that it signals a systemic delay (single-task slippage is tracked on
  // the Tasks tab and shouldn't trigger a top-level red alert).
  const OVERDUE_TASK_THRESHOLD = 3;
  if (dismissed) return null;
  if (daysLate === 0 && overdueTasks.length < OVERDUE_TASK_THRESHOLD) return null;

  const headline = daysLate > 0
    ? `This project is ${daysLate} day${daysLate === 1 ? '' : 's'} past its deadline`
    : `${overdueTasks.length} task${overdueTasks.length === 1 ? '' : 's'} on this project ${overdueTasks.length === 1 ? 'is' : 'are'} overdue`;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--error)]/40 bg-gradient-to-r from-[var(--error)]/12 via-[var(--error)]/8 to-transparent">
      <div className="flex items-start gap-3 px-4 lg:px-5 py-3.5">
        <div className="shrink-0 w-9 h-9 rounded-lg bg-[var(--error)]/15 text-[var(--error)] flex items-center justify-center">
          <AlertTriangle size={18} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-extrabold text-[var(--error)] leading-tight">
              {headline}
            </p>
            {eta && daysLate > 0 && (
              <span className="text-[11px] text-[var(--text-muted)]">
                <Clock size={10} className="inline mr-1 -mt-0.5" />
                ETA was {fmtDate(eta)}
              </span>
            )}
          </div>

          {blockers.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {blockers.map((b, i) => (
                <span
                  key={`${b.name}-${i}`}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--error)]/8 border border-[var(--error)]/20 text-[11px]"
                >
                  <UserIcon size={10} className="text-[var(--error)]" />
                  <span className="font-bold text-[var(--text-primary)]">{b.name}</span>
                  <span className="font-black text-[var(--error)]">· {b.count} overdue</span>
                </span>
              ))}
            </div>
          )}

          {blockers[0]?.oldestTitle && (
            <p className="text-[11px] text-[var(--text-muted)] mt-1.5 truncate">
              Oldest blocked task:{' '}
              <span className="font-semibold text-[var(--text-secondary)]">
                {blockers[0].oldestTitle}
              </span>
              {' '}(due {fmtDate(blockers[0].oldestDueDate)})
            </p>
          )}
        </div>

        {onViewTasks && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onViewTasks}
            className="shrink-0 !text-[var(--error)] !bg-[var(--error)]/10 hover:!bg-[var(--error)]/15"
          >
            View Overdue Tasks <ArrowRight size={12} className="ml-1" />
          </Button>
        )}

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 p-1.5 rounded-lg text-[var(--error)]/70 hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors"
          title="Dismiss"
          aria-label="Dismiss overdue banner"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default ProjectDelayBanner;
