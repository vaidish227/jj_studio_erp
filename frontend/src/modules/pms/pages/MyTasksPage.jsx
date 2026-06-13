import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckSquare, Search, Play, Send, RotateCcw,
  PauseCircle, Calendar, Briefcase, ChevronRight, AlertCircle,
  X, RefreshCw,
} from 'lucide-react';
import { Loader } from '../../../shared/components';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { useAuth } from '../../../shared/context/AuthContext';
import TaskStatusBadge from '../components/TaskStatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import TaskTypeIcon, { TASK_TYPE_CONFIG } from '../components/TaskTypeIcon';
import SubmitForReviewModal from '../components/SubmitForReviewModal';
import TaskStatusUpdateModal from '../components/TaskStatusUpdateModal';
import AskAIButton from '../../ai/components/AskAIButton';
import { resolveEntry } from '../../ai/aiEntryPoints';

const fmt = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';

const isOverdue = (task) =>
  task.dueDate &&
  new Date(task.dueDate) < new Date() &&
  !['completed', 'released_to_site', 'approved'].includes(task.status);

// ── Status filter options ────────────────────────────────────────────────────
const STATUS_FILTERS = [
  { label: 'All',              value: '' },
  { label: 'Not Started',      value: 'not_started' },
  { label: 'In Progress',      value: 'in_progress' },
  { label: 'On Hold',          value: 'on_hold' },
  { label: 'Pending Review',   value: 'pending_review' },
  { label: 'Revision Needed',  value: 'revision_requested' },
  { label: 'Completed',        value: 'completed' },
];

const PRIORITY_FILTERS = [
  { label: 'All priorities', value: '' },
  { label: 'Urgent', value: 'urgent' },
  { label: 'High',   value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low',    value: 'low' },
];

// Status → accent colour (mirrors TaskDetailPage STATUS_META). Drives the
// left accent stripe on each task card so status reads at a glance.
const STATUS_COLOR = {
  not_started:             'var(--text-muted)',
  blocked:                 'var(--error)',
  in_progress:             'var(--accent-blue)',
  pending_review:          'var(--warning)',
  revision_requested:      'var(--error)',
  pending_client_approval: 'var(--accent-blue)',
  approved:                'var(--success)',
  released_to_site:        'var(--primary)',
  completed:               'var(--success)',
  on_hold:                 'var(--warning)',
};

// ── Task row ─────────────────────────────────────────────────────────────────
const TaskRow = ({ task, onUpdated }) => {
  const navigate  = useNavigate();
  const toast     = useToast();
  const { user, hasPermission } = useAuth();

  const [showSubmit,  setShowSubmit]  = useState(false);
  const [holdModal,   setHoldModal]   = useState(null);  // targetStatus
  const [actioning,   setActioning]   = useState(false);

  const cfg       = TASK_TYPE_CONFIG[task.taskType] || {};
  const overdue   = isOverdue(task);
  const accent    = STATUS_COLOR[task.status] || 'var(--border)';
  const isMyTask  = String(task.assignedTo?._id || task.assignedTo) === String(user?._id);

  const canStart    = isMyTask && task.status === 'not_started';
  const canResume   = isMyTask && task.status === 'revision_requested';
  const canResumeHold = isMyTask && task.status === 'on_hold';
  const canSubmit   = isMyTask && hasPermission('tasks.submit') && ['in_progress', 'revision_requested'].includes(task.status);
  const canHold     = isMyTask && task.status === 'in_progress';
  // Submit needs at least one drawing — empty submissions waste the
  // reviewer's time. Backend rejects 400 as a safety net.
  const hasDrawings = (task.drawingCount || 0) > 0;

  const quickStart = async (status) => {
    setActioning(true);
    try {
      await pmsService.updateTask(task._id, { status });
      toast.success(status === 'in_progress' ? 'Task started' : 'Task updated');
      onUpdated?.();
    } catch (err) {
      toast.error(err?.message || 'Failed to update task');
    } finally {
      setActioning(false);
    }
  };

  return (
    <>
      <div
        className={`group relative bg-[var(--surface)] border rounded-2xl pl-5 pr-4 py-4 cursor-pointer space-y-3
                   overflow-hidden transition-all duration-200
                   hover:border-[var(--primary)]/50 hover:shadow-[0_4px_16px_-6px_rgba(42,32,23,0.18)] hover:-translate-y-0.5
                   ${overdue ? 'border-[var(--error)]/40' : 'border-[var(--border)]'}`}
        onClick={() => navigate(`/tasks/${task._id}`)}
      >
        {/* Status accent stripe */}
        <span className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: accent }} aria-hidden />

        {/* Top row: type icon + title + status */}
        <div className="flex items-start gap-3">
          <TaskTypeIcon taskType={task.taskType} />

          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-0.5">
              {cfg.label || task.taskType}
            </p>
            <p className="text-[15px] font-bold text-[var(--text-primary)] leading-snug truncate">
              {task.title}
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-1.5">
            <TaskStatusBadge status={task.status} />
            <ChevronRight size={16} className="text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--primary)]" />
          </div>
        </div>

        {/* Blocked-by-dependency alert */}
        {task.status === 'blocked' && (task.blockingTasks?.length > 0 || task.blockingGates?.length > 0) && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[var(--error)]/8 border border-[var(--error)]/20"
            onClick={(e) => e.stopPropagation()}>
            <AlertCircle size={13} className="text-[var(--error)] shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--error)] leading-snug">
              <span className="font-bold">Blocked — </span>
              {task.blockingTasks?.length > 0 && (
                <>waiting on <span className="font-semibold">{task.blockingTasks.map((b) => b.title).join(', ')}</span></>
              )}
              {task.blockingTasks?.length > 0 && task.blockingGates?.length > 0 && ' · '}
              {task.blockingGates?.length > 0 && (
                <>approval: <span className="font-semibold">{task.blockingGates.map((g) => g.label || g.key).join(', ')}</span></>
              )}
            </p>
          </div>
        )}

        {/* On hold / revision alert */}
        {task.status === 'on_hold' && task.holdReason && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[var(--warning)]/8 border border-[var(--warning)]/20"
            onClick={(e) => e.stopPropagation()}>
            <PauseCircle size={13} className="text-[var(--warning)] shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--warning)] leading-snug">{task.holdReason}</p>
          </div>
        )}
        {task.status === 'revision_requested' && task.revisionInstructions && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[var(--error)]/8 border border-[var(--error)]/20"
            onClick={(e) => e.stopPropagation()}>
            <AlertCircle size={13} className="text-[var(--error)] shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--error)] leading-snug line-clamp-2">{task.revisionInstructions}</p>
          </div>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-3 flex-wrap">
          <PriorityBadge priority={task.priority} />

          {task.projectId?.name && (
            <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
              <Briefcase size={11} />
              <span className="truncate max-w-[140px]">{task.projectId.name}</span>
            </div>
          )}

          <div className={`flex items-center gap-1 text-xs ${overdue ? 'text-[var(--error)] font-semibold' : 'text-[var(--text-muted)]'}`}>
            <Calendar size={11} />
            <span>{fmt(task.dueDate)}</span>
            {overdue && <span className="text-[10px] font-black">· OVERDUE</span>}
          </div>

          {task.submittedAt && (
            <div className="ml-auto text-[10px] font-bold text-[var(--accent-green)] bg-[var(--accent-green)]/10 px-2 py-0.5 rounded-full">
              Submitted {fmt(task.submittedAt)}
            </div>
          )}
        </div>

        {/* Checklist mini-progress */}
        {task.checklist?.length > 0 && (() => {
          const done  = task.checklist.filter((c) => c.isCompleted).length;
          const total = task.checklist.length;
          return (
            <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                <span>Checklist</span>
                <span>{done}/{total}</span>
              </div>
              <div className="h-1 rounded-full bg-[var(--border)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--primary)] transition-all"
                  style={{ width: `${Math.round((done / total) * 100)}%` }}
                />
              </div>
            </div>
          );
        })()}

        {/* Quick action buttons */}
        {(canStart || canResume || canResumeHold || canSubmit || canHold) && (
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[var(--border)]"
            onClick={(e) => e.stopPropagation()}>

            {canStart && (
              <button
                onClick={() => quickStart('in_progress')}
                disabled={actioning}
                className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded-lg
                           bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/20 transition-colors disabled:opacity-50"
              >
                <Play size={10} /> Start Task
              </button>
            )}

            {canResume && (
              <button
                onClick={() => quickStart('in_progress')}
                disabled={actioning}
                className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded-lg
                           bg-[var(--warning)]/10 text-[var(--warning)] hover:bg-[var(--warning)]/20 transition-colors disabled:opacity-50"
              >
                <RotateCcw size={10} /> Start Revision
              </button>
            )}

            {canResumeHold && (
              <button
                onClick={() => setHoldModal('in_progress')}
                disabled={actioning}
                className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded-lg
                           bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/20 transition-colors disabled:opacity-50"
              >
                <Play size={10} /> Resume
              </button>
            )}

            {canHold && (
              <button
                onClick={() => setHoldModal('on_hold')}
                disabled={actioning}
                className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded-lg
                           bg-[var(--warning)]/10 text-[var(--warning)] hover:bg-[var(--warning)]/20 transition-colors disabled:opacity-50"
              >
                <PauseCircle size={10} /> Put On Hold
              </button>
            )}

            {canSubmit && (
              <button
                onClick={() => setShowSubmit(true)}
                disabled={actioning || !hasDrawings}
                title={!hasDrawings ? 'Upload a drawing first — a review needs something to review.' : undefined}
                className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded-lg
                           bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
              >
                <Send size={10} /> {hasDrawings ? 'Submit for Review' : 'Upload Drawing First'}
              </button>
            )}
          </div>
        )}
      </div>

      <SubmitForReviewModal
        task={task}
        isOpen={showSubmit}
        onClose={() => setShowSubmit(false)}
        onSubmitted={() => { setShowSubmit(false); onUpdated?.(); }}
        drawingCount={task.drawingCount ?? null}
      />

      <TaskStatusUpdateModal
        isOpen={!!holdModal}
        onClose={() => setHoldModal(null)}
        task={task}
        targetStatus={holdModal}
        onUpdated={() => { setHoldModal(null); onUpdated?.(); }}
      />
    </>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
const MyTasksPage = () => {
  const toast = useToast();
  const [tasks, setTasks]         = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [version, setVersion]     = useState(0);

  // Filter state
  const [search,   setSearch]   = useState('');
  const [status,   setStatus]   = useState('');
  const [priority, setPriority] = useState('');
  const [overdue,  setOverdue]  = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    pmsService.getMyTasks()
      .then((res) => { if (!cancelled) setTasks(res.tasks || []); })
      .catch(() => { if (!cancelled) toast.error('Failed to load tasks'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => setVersion((v) => v + 1);

  // Client-side filter
  const filtered = useMemo(() => {
    let list = tasks;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) =>
        t.title?.toLowerCase().includes(q) ||
        t.projectId?.name?.toLowerCase().includes(q)
      );
    }
    if (status)   list = list.filter((t) => t.status === status);
    if (priority) list = list.filter((t) => t.priority === priority);
    if (overdue)  list = list.filter((t) => isOverdue(t));
    return list;
  }, [tasks, search, status, priority, overdue]);

  // Quick stat counts
  const counts = useMemo(() => ({
    total:       tasks.length,
    inProgress:  tasks.filter((t) => t.status === 'in_progress').length,
    onHold:      tasks.filter((t) => t.status === 'on_hold').length,
    revision:    tasks.filter((t) => t.status === 'revision_requested').length,
    overdue:     tasks.filter((t) => isOverdue(t)).length,
  }), [tasks]);

  // Per-status counts that drive the filter-tab badges
  const statusCounts = useMemo(() => {
    const m = {};
    for (const t of tasks) m[t.status] = (m[t.status] || 0) + 1;
    return m;
  }, [tasks]);

  const anyFilter = search || status || priority || overdue;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-5xl mx-auto">

      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[var(--primary)]/25 to-[var(--primary)]/5 border border-[var(--primary)]/20 flex items-center justify-center">
          <CheckSquare size={20} className="text-[var(--primary)]" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-[var(--text-primary)] leading-tight">My Tasks</h1>
          <p className="text-xs text-[var(--text-muted)]">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''} assigned
            {counts.overdue > 0 && (
              <> · <span className="text-[var(--error)] font-bold">{counts.overdue} overdue</span></>
            )}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <AskAIButton label="Ask AI" variant="soft" size="sm" actions={resolveEntry('myTasks').actions} />
          <button
            type="button"
            onClick={refresh}
            title="Refresh"
            className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)]
                       rounded-xl px-3 py-2 hover:border-[var(--primary)]/40 hover:text-[var(--primary)] transition-colors"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Filter toolbar ─────────────────────────────────────────────────── */}
      {tasks.length > 0 && (
        <div className="space-y-3">
          {/* Search */}
          <div className="flex items-center gap-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3.5 py-2.5
                          transition-colors focus-within:border-[var(--primary)]/50 focus-within:shadow-[0_0_0_3px_var(--primary-soft,rgba(193,154,69,0.12))]">
            <Search size={15} className="text-[var(--text-muted)] shrink-0" />
            <input
              type="text"
              placeholder="Search tasks or projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')}
                className="p-0.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)] transition-colors">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status tabs with live counts */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mb-1">
            {STATUS_FILTERS.map((f) => {
              const active = status === f.value;
              const count  = f.value === '' ? counts.total : (statusCounts[f.value] || 0);
              return (
                <button
                  key={f.value || 'all'}
                  type="button"
                  onClick={() => setStatus(active ? '' : f.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all
                    ${active
                      ? 'bg-[var(--primary)] text-black shadow-sm'
                      : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--primary)]/40 hover:text-[var(--primary)]'}`}
                >
                  {f.label}
                  {count > 0 && (
                    <span className={`min-w-[18px] text-center px-1.5 rounded-full text-[10px] font-black
                      ${active ? 'bg-black/15 text-black' : 'bg-[var(--bg)] text-[var(--text-muted)]'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}

            <span className="w-px h-5 bg-[var(--border)] mx-1 shrink-0" />

            {/* Overdue (independent toggle) */}
            <button
              type="button"
              onClick={() => setOverdue((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all
                ${overdue
                  ? 'bg-[var(--error)] text-white shadow-sm'
                  : 'bg-[var(--surface)] border border-[var(--error)]/30 text-[var(--error)] hover:bg-[var(--error)]/5'}`}
            >
              <AlertCircle size={12} /> Overdue
              {counts.overdue > 0 && (
                <span className={`min-w-[18px] text-center px-1.5 rounded-full text-[10px] font-black
                  ${overdue ? 'bg-white/25 text-white' : 'bg-[var(--error)]/10 text-[var(--error)]'}`}>
                  {counts.overdue}
                </span>
              )}
            </button>
          </div>

          {/* Secondary: priority + clear */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold
                         text-[var(--text-secondary)] outline-none focus:border-[var(--primary)] transition-colors"
            >
              {PRIORITY_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>

            {anyFilter && (
              <button
                type="button"
                onClick={() => { setSearch(''); setStatus(''); setPriority(''); setOverdue(false); }}
                className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--error)] font-semibold transition-colors"
              >
                <X size={12} /> Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Task list */}
      {tasks.length === 0 ? (
        <div className="text-center py-24 text-[var(--text-muted)]">
          <CheckSquare size={40} className="mx-auto mb-4 opacity-20" />
          <p className="text-sm font-semibold">No tasks assigned to you.</p>
          <p className="text-xs mt-1">Tasks assigned by your project manager will appear here.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <p className="text-sm">No tasks match your filters.</p>
          <button
            type="button"
            onClick={() => { setSearch(''); setStatus(''); setPriority(''); setOverdue(false); }}
            className="text-xs text-[var(--primary)] hover:underline font-semibold mt-2"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => (
            <TaskRow key={task._id} task={task} onUpdated={refresh} />
          ))}
          <p className="text-center text-xs text-[var(--text-muted)] pt-2">
            {filtered.length} of {tasks.length} task{tasks.length !== 1 ? 's' : ''}
            {anyFilter ? ' (filtered)' : ''}
          </p>
        </div>
      )}
    </div>
  );
};

export default MyTasksPage;
