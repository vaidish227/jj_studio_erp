import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckSquare, Search, Filter, Play, Send, RotateCcw,
  PauseCircle, Calendar, Briefcase, ChevronRight, AlertCircle,
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
  { label: 'All',    value: '' },
  { label: 'Urgent', value: 'urgent' },
  { label: 'High',   value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low',    value: 'low' },
];

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
  const isMyTask  = String(task.assignedTo?._id || task.assignedTo) === String(user?._id);

  const canStart    = isMyTask && task.status === 'not_started';
  const canResume   = isMyTask && task.status === 'revision_requested';
  const canResumeHold = isMyTask && task.status === 'on_hold';
  const canSubmit   = isMyTask && hasPermission('tasks.submit') && ['in_progress', 'revision_requested'].includes(task.status);
  const canHold     = isMyTask && task.status === 'in_progress';

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
        className={`bg-[var(--surface)] border rounded-xl p-4 cursor-pointer
                   hover:border-[var(--primary)]/40 transition-all duration-150 space-y-3
                   ${overdue ? 'border-[var(--error)]/30' : 'border-[var(--border)]'}`}
        onClick={() => navigate(`/tasks/${task._id}`)}
      >
        {/* Top row: type icon + title + status */}
        <div className="flex items-start gap-3">
          <TaskTypeIcon taskType={task.taskType} />

          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-0.5">
              {cfg.label || task.taskType}
            </p>
            <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug">
              {task.title}
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <TaskStatusBadge status={task.status} />
            <ChevronRight size={13} className="text-[var(--text-muted)]" />
          </div>
        </div>

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
                disabled={actioning}
                className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded-lg
                           bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-colors disabled:opacity-50 ml-auto"
              >
                <Send size={10} /> Submit for Review
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
        <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center">
          <CheckSquare size={20} className="text-[var(--primary)]" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-[var(--text-primary)]">My Task</h1>
          <p className="text-xs text-[var(--text-muted)]">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''} assigned to you
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="ml-auto text-xs text-[var(--text-muted)] hover:text-[var(--primary)] font-semibold transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Stat pills */}
      {tasks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Total',      value: counts.total,      color: 'var(--text-muted)',    filter: () => setStatus('') },
            { label: 'In Progress',value: counts.inProgress, color: 'var(--accent-blue)',   filter: () => setStatus('in_progress') },
            { label: 'On Hold',    value: counts.onHold,     color: 'var(--warning)',        filter: () => setStatus('on_hold') },
            { label: 'Revision',   value: counts.revision,   color: 'var(--error)',          filter: () => setStatus('revision_requested') },
            { label: 'Overdue',    value: counts.overdue,    color: 'var(--error)',          filter: () => setOverdue((v) => !v) },
          ].map(({ label, value, color, filter }) => value > 0 && (
            <button
              key={label}
              type="button"
              onClick={filter}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors
                         hover:border-[var(--primary)]/40 hover:bg-[var(--primary)]/5"
              style={{ borderColor: `color-mix(in srgb, ${color} 30%, transparent)` }}
            >
              <span style={{ color }} className="text-sm font-black">{value}</span>
              <span className="text-[var(--text-muted)]">{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-[var(--surface)] border border-[var(--border)]
                        rounded-xl px-3 py-2">
          <Search size={14} className="text-[var(--text-muted)] shrink-0" />
          <input
            type="text"
            placeholder="Search tasks or projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                       outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Filter size={13} className="text-[var(--text-muted)]" />
          {STATUS_FILTERS.slice(1).map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatus(status === f.value ? '' : f.value)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap
                ${status === f.value
                  ? 'bg-[var(--primary)] text-black'
                  : 'bg-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary)]'}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm
                     text-[var(--text-secondary)] outline-none focus:border-[var(--primary)] shrink-0"
        >
          {PRIORITY_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setOverdue((v) => !v)}
          className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap
            ${overdue
              ? 'bg-[var(--error)] border-[var(--error)] text-white'
              : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--error)]/40 hover:text-[var(--error)]'}`}
        >
          Overdue Only
        </button>

        {anyFilter && (
          <button
            type="button"
            onClick={() => { setSearch(''); setStatus(''); setPriority(''); setOverdue(false); }}
            className="text-xs text-[var(--primary)] hover:underline font-semibold shrink-0"
          >
            Clear filters
          </button>
        )}
      </div>

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
