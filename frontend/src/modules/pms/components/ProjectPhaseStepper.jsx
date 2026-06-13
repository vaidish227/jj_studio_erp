import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Info, ChevronDown, ChevronRight, ListTodo } from 'lucide-react';
import TaskStatusBadge from './TaskStatusBadge';

// Fallback — used only for legacy effective projects that have no plan
// snapshot stored (created before the per-project snapshot shipped).
const DEFAULT_PHASES = [
  { key: 'kickoff',     label: 'Kickoff'     },
  { key: 'layout',      label: 'Layout'      },
  { key: 'design',      label: 'Design'      },
  { key: 'procurement', label: 'Procurement' },
  { key: 'release',     label: 'Release'     },
  { key: 'execution',   label: 'Execution'   },
  { key: 'handover',    label: 'Handover'    },
];

/**
 * ProjectPhaseStepper — segmented stage tracker.
 *
 * Phase list is read from `project.planSnapshot.phases` — the per-project
 * plan snapshot — so a project built from a custom plan (e.g. "Villa Premium"
 * with a "Vastu" phase) displays its own flow. Falls back to the canonical
 * 7-phase list for legacy effective projects without a snapshot.
 *
 * Each stage is a clickable segment: it shows the stage state (done /
 * current / upcoming), a per-stage task completion bar, and expands a panel
 * listing that stage's tasks with their statuses. Task rows navigate to the
 * task detail page.
 *
 * Hidden entirely (replaced by a hint card) until the plan is made effective.
 */
const STATUS_FALLBACK = {
  design_phase:    'design',
  execution_phase: 'execution',
  handover:        'handover',
  completed:       'handover',
};

const DONE_TASK_STATUSES = new Set(['approved', 'released_to_site', 'completed']);

const slugify = (s) => String(s || '').toLowerCase().trim().replace(/\s+/g, '_');

const ProjectPhaseStepper = ({ project, tasks = [], className = '' }) => {
  const navigate = useNavigate();
  const [openIdx, setOpenIdx] = useState(null);

  // Prefer snapshot phases over the hardcoded fallback. Sort by `order` so
  // re-ordered phases render correctly.
  const phases = useMemo(() => {
    const snapPhases = project?.planSnapshot?.phases;
    if (Array.isArray(snapPhases) && snapPhases.length > 0) {
      return [...snapPhases]
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((p) => ({
          key:   slugify(p.name),
          label: String(p.name || '')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase()),
        }));
    }
    return DEFAULT_PHASES;
  }, [project]);

  // Per-phase task buckets — task.phase carries the snapshot phase name.
  const buckets = useMemo(() => {
    const map = {};
    for (const t of tasks || []) {
      const k = slugify(t.phase);
      if (!k) continue;
      if (!map[k]) map[k] = { total: 0, done: 0, tasks: [] };
      map[k].total += 1;
      if (DONE_TASK_STATUSES.has(t.status)) map[k].done += 1;
      map[k].tasks.push(t);
    }
    return map;
  }, [tasks]);

  if (!project) return null;

  // Stages are meaningless while the plan is still a draft — show a hint
  // card instead of the stepper until the plan is made effective.
  const planEffectiveAt = project?.planEffectiveAt;
  if (!planEffectiveAt) {
    return (
      <div className={`bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-2xl p-3 lg:p-4 ${className}`}>
        <p className="text-xs text-[var(--text-muted)] italic flex items-center gap-1.5"><Info size={13} /> Stages will appear once the project plan is made effective.</p>
      </div>
    );
  }

  const isProjectDone = project.status === 'completed';
  const currentPhase  = slugify(project.phase) || STATUS_FALLBACK[project.status] || phases[0]?.key || 'kickoff';
  const currentIdx    = isProjectDone
    ? phases.length
    : Math.max(0, phases.findIndex((p) => p.key === currentPhase));

  const openPhase  = openIdx != null ? phases[openIdx] : null;
  const openBucket = openPhase ? buckets[openPhase.key] : null;

  return (
    <div className={`bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 lg:px-5 ${className}`}>
      {/* Header strip */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
          Project Stages
        </span>
        {isProjectDone ? (
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--success)] inline-flex items-center gap-1">
            <Check size={11} strokeWidth={3} /> All stages complete
          </span>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            Stage {currentIdx + 1} of {phases.length}
            {' · '}
            <span className="text-[var(--primary)]">{phases[currentIdx]?.label}</span>
          </span>
        )}
      </div>

      {/* Stage segments */}
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {phases.map((phase, idx) => {
          const isDone    = idx < currentIdx;
          const isCurrent = !isProjectDone && idx === currentIdx;
          const bucket    = buckets[phase.key];
          const total     = bucket?.total || 0;
          const done      = bucket?.done || 0;
          const pct       = total > 0 ? Math.round((done / total) * 100) : (isDone ? 100 : 0);
          const isOpen    = openIdx === idx;

          return (
            <button
              key={`${phase.key}-${idx}`}
              type="button"
              onClick={() => setOpenIdx(isOpen ? null : idx)}
              aria-expanded={isOpen}
              title={`${phase.label} — view tasks`}
              className={`flex-1 min-w-[148px] shrink-0 text-left rounded-xl border px-3 py-2.5 transition-all
                ${isDone    ? 'bg-[var(--success)]/6 border-[var(--success)]/25 hover:border-[var(--success)]/50' : ''}
                ${isCurrent ? 'bg-[var(--primary)]/8 border-[var(--primary)]/40 hover:border-[var(--primary)]/60' : ''}
                ${!isDone && !isCurrent ? 'bg-[var(--bg)] border-[var(--border)] hover:border-[var(--text-muted)]/40' : ''}
                ${isOpen ? 'ring-2 ring-[var(--primary)]/25' : ''}
              `}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[10px] font-black
                    ${isDone    ? 'bg-[var(--success)] text-white' : ''}
                    ${isCurrent ? 'bg-[var(--primary)] text-white ring-4 ring-[var(--primary)]/15' : ''}
                    ${!isDone && !isCurrent ? 'bg-[var(--surface)] border-2 border-[var(--border)] text-[var(--text-muted)]' : ''}
                  `}
                >
                  {isDone ? <Check size={12} strokeWidth={3} /> : idx + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[11px] uppercase tracking-wider leading-tight truncate
                      ${isDone    ? 'text-[var(--success)] font-bold' : ''}
                      ${isCurrent ? 'text-[var(--primary)] font-black' : ''}
                      ${!isDone && !isCurrent ? 'text-[var(--text-muted)] font-semibold' : ''}
                    `}
                  >
                    {phase.label}
                  </p>
                  <p className="text-[9px] text-[var(--text-muted)] tabular-nums mt-0.5">
                    {total > 0 ? `${done}/${total} tasks done` : 'No tasks yet'}
                    {isCurrent ? ' · in progress' : ''}
                  </p>
                </div>

                <ChevronDown
                  size={13}
                  className={`shrink-0 text-[var(--text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </div>

              {/* Per-stage completion bar */}
              <div className="mt-2 h-1 rounded-full bg-[var(--border)]/60 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isDone || pct === 100 ? 'bg-[var(--success)]' : 'bg-[var(--primary)]'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Expanded stage — task list */}
      {openPhase && (
        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          <div className="flex items-center gap-1.5 mb-2">
            <ListTodo size={13} className="text-[var(--primary)]" />
            <span className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wider">
              {openPhase.label} — Tasks
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">({openBucket?.tasks.length || 0})</span>
          </div>

          {!openBucket || openBucket.tasks.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] italic py-2">No tasks in this stage yet.</p>
          ) : (
            <div className="divide-y divide-[var(--border)]/60 rounded-xl border border-[var(--border)] overflow-hidden">
              {openBucket.tasks.map((t) => (
                <button
                  key={t._id}
                  type="button"
                  onClick={() => navigate(`/tasks/${t._id}`)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left bg-[var(--bg)]/40 hover:bg-[var(--bg)] transition-colors"
                  title="Open task detail"
                >
                  <span
                    className={`w-1.5 h-1.5 shrink-0 rounded-full
                      ${DONE_TASK_STATUSES.has(t.status) ? 'bg-[var(--success)]' : t.status === 'not_started' ? 'bg-[var(--border)]' : 'bg-[var(--primary)]'}`}
                  />
                  <span className="flex-1 min-w-0 text-xs font-semibold text-[var(--text-primary)] truncate">
                    {t.title}
                  </span>
                  {t.assignedTo?.name && (
                    <span className="hidden sm:block shrink-0 text-[10px] text-[var(--text-muted)] truncate max-w-[120px]">
                      {t.assignedTo.name}
                    </span>
                  )}
                  <TaskStatusBadge status={t.status} className="shrink-0" />
                  <ChevronRight size={13} className="shrink-0 text-[var(--text-muted)]" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectPhaseStepper;
