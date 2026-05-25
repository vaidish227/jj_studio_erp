import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ChevronDown, ChevronUp, User, Play, Send, RotateCcw, ChevronRight } from 'lucide-react';
import { useAuth } from '../../../shared/context/AuthContext';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../shared/services/pmsService';
import TaskStatusBadge from './TaskStatusBadge';
import PriorityBadge from './PriorityBadge';
import TaskTypeIcon, { TASK_TYPE_CONFIG } from './TaskTypeIcon';
import ChecklistPanel from './ChecklistPanel';
import SubmitForReviewModal from './SubmitForReviewModal';

const fmt = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  : null;

const TaskCard = ({ task, onUpdated, compact = false }) => {
  const navigate  = useNavigate();
  const { user, hasPermission } = useAuth();
  const toast     = useToast();

  const [expanded,     setExpanded]     = useState(false);
  const [showSubmit,   setShowSubmit]   = useState(false);
  const [actioning,    setActioning]    = useState(false);

  const cfg        = TASK_TYPE_CONFIG[task.taskType] || {};
  const doneCount  = (task.checklist || []).filter((c) => c.isCompleted).length;
  const totalCount = (task.checklist || []).length;
  const isOverdue  = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';

  const isMyTask     = String(task.assignedTo?._id || task.assignedTo) === String(user?._id);
  const canStart     = isMyTask && task.status === 'not_started';
  const canRevision  = isMyTask && task.status === 'revision_requested';
  const canSubmit    = isMyTask && hasPermission('tasks.submit') && ['in_progress', 'revision_requested'].includes(task.status);

  const handleStatusUpdate = async (status, e) => {
    e.stopPropagation();
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

  const goToDetail = () => navigate(`/tasks/${task._id}`);

  return (
    <>
      <div
        className={`bg-[var(--surface)] border border-[var(--border)] rounded-xl
                   hover:border-[var(--primary)]/40 transition-all duration-150 cursor-pointer
                   ${compact ? 'p-3' : 'p-4'}`}
        onClick={goToDetail}
      >
        {/* Header row */}
        <div className="flex items-start gap-3">
          <TaskTypeIcon taskType={task.taskType} />

          <div className="flex-1 min-w-0">
            <p className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)] mb-0.5">
              {cfg.label || task.taskType}
            </p>
            <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug truncate">
              {task.title}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <TaskStatusBadge status={task.status} />
            <ChevronRight size={13} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100" />
          </div>
        </div>

        {/* Revision instructions alert */}
        {task.status === 'revision_requested' && task.revisionInstructions && (
          <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-[var(--error)]/8 border border-[var(--error)]/20"
            onClick={(e) => e.stopPropagation()}>
            <p className="text-[11px] text-[var(--error)] leading-snug line-clamp-2">
              {task.revisionInstructions}
            </p>
          </div>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <PriorityBadge priority={task.priority} />

          {task.assignedTo && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <div className="w-5 h-5 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-[9px] font-black text-[var(--primary)] uppercase">
                {task.assignedTo.name?.[0] || <User size={10} />}
              </div>
              <span>{task.assignedTo.name}</span>
            </div>
          )}

          {task.dueDate && (
            <div className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-[var(--error)]' : 'text-[var(--text-muted)]'}`}>
              <Calendar size={11} />
              <span>{fmt(task.dueDate)}</span>
            </div>
          )}

          {totalCount > 0 && (
            <span className="text-[10px] font-semibold text-[var(--text-muted)] ml-auto">
              {doneCount}/{totalCount} done
            </span>
          )}
        </div>

        {/* Checklist progress bar */}
        {totalCount > 0 && (
          <div className="mt-2 h-1 rounded-full bg-[var(--border)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--primary)] transition-all"
              style={{ width: `${Math.round((doneCount / totalCount) * 100)}%` }}
            />
          </div>
        )}

        {/* Quick action buttons */}
        {(canStart || canRevision || canSubmit) && (
          <div className="mt-3 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
            {canStart && (
              <button
                onClick={(e) => handleStatusUpdate('in_progress', e)}
                disabled={actioning}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg
                           bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/20
                           transition-colors disabled:opacity-50"
              >
                <Play size={10} /> Start Task
              </button>
            )}
            {canRevision && (
              <button
                onClick={(e) => handleStatusUpdate('in_progress', e)}
                disabled={actioning}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg
                           bg-[var(--warning)]/10 text-[var(--warning)] hover:bg-[var(--warning)]/20
                           transition-colors disabled:opacity-50"
              >
                <RotateCcw size={10} /> Start Revision
              </button>
            )}
            {canSubmit && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowSubmit(true); }}
                disabled={actioning}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg
                           bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20
                           transition-colors disabled:opacity-50"
              >
                <Send size={10} /> Submit for Review
              </button>
            )}
          </div>
        )}

        {/* Expand toggle for checklist */}
        {totalCount > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
            className="mt-3 flex items-center gap-1 text-xs text-[var(--text-muted)]
                       hover:text-[var(--primary)] transition-colors w-full"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? 'Hide checklist' : 'View checklist'}
          </button>
        )}

        {/* Expanded checklist */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-[var(--border)]" onClick={(e) => e.stopPropagation()}>
            <ChecklistPanel
              taskId={task._id}
              checklist={task.checklist}
              onUpdated={onUpdated}
            />
          </div>
        )}
      </div>

      <SubmitForReviewModal
        task={task}
        isOpen={showSubmit}
        onClose={() => setShowSubmit(false)}
        onSubmitted={() => { setShowSubmit(false); onUpdated?.(); }}
      />
    </>
  );
};

export default TaskCard;
