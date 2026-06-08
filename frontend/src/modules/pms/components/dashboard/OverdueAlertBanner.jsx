import React, { useMemo } from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';

/**
 * OverdueAlertBanner — high-visibility red ribbon shown when one or more
 * active projects have crossed their estimatedCompletionDate.
 *
 * Click "Review Now" to open the OverdueProjectsModal (parent-owned), which
 * lists each delayed project with its blocker attribution.
 *
 * Blocker sub-line is only rendered when the API returns a non-empty
 * `blockers[]` (privileged roles only — server-side gated).
 */
const OverdueAlertBanner = ({ delayedProjects = [], onReview }) => {
  // Aggregate top blockers across all delayed projects (dedupe by userId,
  // sum overdueTaskCount). Empty when caller has no blocker visibility.
  // Computed before any early return to keep hook order stable.
  const topBlockers = useMemo(() => {
    const byUser = new Map();
    for (const p of delayedProjects) {
      for (const b of (p.blockers || [])) {
        if (!b?.userId) continue;
        if (!byUser.has(b.userId)) {
          byUser.set(b.userId, { name: b.name, overdueTaskCount: 0 });
        }
        byUser.get(b.userId).overdueTaskCount += (b.overdueTaskCount || 0);
      }
    }
    return [...byUser.values()]
      .sort((a, b) => b.overdueTaskCount - a.overdueTaskCount)
      .slice(0, 3);
  }, [delayedProjects]);

  if (!delayedProjects.length) return null;

  const summary = delayedProjects
    .slice(0, 3)
    .map((p) => `${p.name}${p.daysLate ? ` (${p.daysLate}d late)` : ''}`)
    .join(', ');

  const blockerLine = topBlockers
    .map((b) => `${b.name} (${b.overdueTaskCount})`)
    .join(', ');

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--error)]/40 bg-gradient-to-r from-[var(--error)]/12 via-[var(--error)]/8 to-transparent">
      <div className="flex items-start gap-3 px-4 lg:px-5 py-3.5">
        <div className="shrink-0 w-9 h-9 rounded-lg bg-[var(--error)]/15 text-[var(--error)] flex items-center justify-center">
          <AlertTriangle size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-extrabold text-[var(--error)] leading-tight">
            {delayedProjects.length} {delayedProjects.length === 1 ? 'project has' : 'projects have'} missed their deadlines
          </p>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
            {summary}
          </p>
          {blockerLine && (
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">
              Blocked by:{' '}
              <span className="font-bold text-[var(--error)]/90">{blockerLine}</span>
            </p>
          )}
        </div>
        {onReview && (
          <button
            type="button"
            onClick={onReview}
            className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--error)] text-white text-[11px] font-black uppercase tracking-widest hover:bg-[var(--error)]/90 transition-colors"
          >
            Review Now <ArrowRight size={12} />
          </button>
        )}
      </div>
    </div>
  );
};

export default OverdueAlertBanner;
