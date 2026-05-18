import React, { useState } from 'react';
import { Calendar, ChevronDown, ChevronUp, User } from 'lucide-react';
import TaskStatusBadge from './TaskStatusBadge';
import PriorityBadge from './PriorityBadge';
import TaskTypeIcon, { TASK_TYPE_CONFIG } from './TaskTypeIcon';
import ChecklistPanel from './ChecklistPanel';

const fmt = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  : null;

const TaskCard = ({ task, onUpdated, compact = false }) => {
  const [expanded, setExpanded] = useState(false);

  const cfg         = TASK_TYPE_CONFIG[task.taskType] || {};
  const doneCount   = (task.checklist || []).filter((c) => c.isCompleted).length;
  const totalCount  = (task.checklist || []).length;
  const isOverdue   = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';

  return (
    <div className={`bg-[var(--surface)] border border-[var(--border)] rounded-xl
                     hover:border-[var(--primary)]/40 transition-all duration-150
                     ${compact ? 'p-3' : 'p-4'}`}>

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

        <TaskStatusBadge status={task.status} />
      </div>

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

      {/* Expand toggle */}
      {totalCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 flex items-center gap-1 text-xs text-[var(--text-muted)]
                     hover:text-[var(--primary)] transition-colors w-full"
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {expanded ? 'Hide checklist' : 'View checklist'}
        </button>
      )}

      {/* Expanded checklist */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          <ChecklistPanel
            taskId={task._id}
            checklist={task.checklist}
            onUpdated={onUpdated}
          />
        </div>
      )}
    </div>
  );
};

export default TaskCard;
