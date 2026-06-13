import React, { useState } from 'react';
import { Plus, List, LayoutGrid, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '../../../../shared/components';
import PermissionGate from '../../../../shared/components/PermissionGate/PermissionGate';
import TaskCard from '../TaskCard';
import CreateTaskModal from '../CreateTaskModal';
import { TASK_TYPE_CONFIG } from '../TaskTypeIcon';

const KANBAN_COLUMNS = [
  { id: 'not_started',              label: 'Not Started',       color: 'text-[var(--text-muted)]',    bg: 'bg-[var(--border)]',               border: 'border-[var(--border)]' },
  { id: 'in_progress',              label: 'In Progress',       color: 'text-[var(--accent-blue)]',   bg: 'bg-[var(--accent-blue)]/10',       border: 'border-[var(--accent-blue)]/30' },
  { id: 'revision_requested',       label: 'Revision Needed',   color: 'text-[var(--error)]',         bg: 'bg-[var(--error)]/10',             border: 'border-[var(--error)]/30' },
  { id: 'pending_review',           label: 'Pending Review',    color: 'text-[var(--warning)]',       bg: 'bg-[var(--warning)]/10',           border: 'border-[var(--warning)]/30' },
  { id: 'pending_client_approval',  label: 'Client Approval',   color: 'text-[var(--accent-blue)]',   bg: 'bg-[var(--accent-blue)]/10',       border: 'border-[var(--accent-blue)]/30' },
  { id: 'on_hold',                  label: 'On Hold',           color: 'text-[var(--text-muted)]',    bg: 'bg-[var(--border)]',               border: 'border-[var(--border)]' },
  { id: 'approved',                 label: 'Approved',          color: 'text-[var(--success)]',       bg: 'bg-[var(--success)]/10',           border: 'border-[var(--success)]/30' },
  { id: 'released_to_site',         label: 'Released to Site',  color: 'text-[var(--primary)]',       bg: 'bg-[var(--primary)]/10',           border: 'border-[var(--primary)]/30' },
  { id: 'completed',                label: 'Completed',         color: 'text-[var(--success)]',       bg: 'bg-[var(--success)]/10',           border: 'border-[var(--success)]/30' },
];

const KanbanBoard = ({ tasks, onTaskUpdated }) => {
  const byStatus = tasks.reduce((acc, t) => {
    const key = t.status || 'not_started';
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  return (
    <div className="overflow-x-auto pb-2 -mx-1 px-1">
      <div className="flex gap-3 min-w-max">
        {KANBAN_COLUMNS.map((col) => {
          const colTasks = byStatus[col.id] || [];
          return (
            <div
              key={col.id}
              className={`w-[260px] shrink-0 rounded-2xl border ${col.border} bg-[var(--bg)] flex flex-col min-h-[260px]`}
            >
              <div className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-t-2xl ${col.bg}`}>
                <span className={`text-[11px] font-black uppercase tracking-wider ${col.color} truncate`}>
                  {col.label}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--surface)] ${col.color} shrink-0`}>
                  {colTasks.length}
                </span>
              </div>
              <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[65vh]">
                {colTasks.length === 0 ? (
                  <p className="text-[11px] text-[var(--text-muted)] text-center pt-6">No tasks</p>
                ) : (
                  colTasks.map((task) => (
                    <TaskCard key={task._id} task={task} onUpdated={onTaskUpdated} compact />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TaskGroup = ({ type, typeTasks, onTaskUpdated }) => {
  const [open, setOpen] = useState(true);
  const cfg = TASK_TYPE_CONFIG[type];

  return (
    <div className={`border border-[var(--border)] rounded-2xl bg-[var(--surface)] overflow-hidden
                     transition-colors hover:border-[var(--primary)]/30
                     ${open ? 'shadow-sm' : ''}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 group select-none px-4 py-3 transition-colors
                    ${open ? 'border-b border-[var(--border)] bg-[var(--bg)]/40' : 'hover:bg-[var(--bg)]/40'}`}
      >
        {open
          ? <ChevronDown size={14} className="text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors" />
          : <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors" />
        }
        {cfg && (
          <div className={`w-5 h-5 rounded flex items-center justify-center ${cfg.bg}`}>
            <cfg.Icon size={12} className={cfg.color} />
          </div>
        )}
        <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)] group-hover:text-[var(--primary)] transition-colors">
          {cfg?.label || type}
        </h3>
        <span className="text-[10px] font-bold text-[var(--text-muted)] ml-auto bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 rounded-full">
          {typeTasks.length}
        </span>
      </button>

      {open && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 p-4 animate-[fadeIn_0.15s_ease-out]">
          {typeTasks.map((task) => (
            <TaskCard key={task._id} task={task} onUpdated={onTaskUpdated} />
          ))}
        </div>
      )}
    </div>
  );
};

const ListView = ({ tasks, onTaskUpdated }) => {
  const grouped = tasks.reduce((acc, task) => {
    const key = task.taskType || 'other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([type, typeTasks]) => (
        <TaskGroup key={type} type={type} typeTasks={typeTasks} onTaskUpdated={onTaskUpdated} />
      ))}
    </div>
  );
};

// Furniture layout gate indicator — surfaces the high-value "all clear" signal
// once Furniture Layout is approved so the PM knows design sub-tasks (AC, Kitchen,
// Bathroom, Technical, Concept) are now safe to assign. The pre-approval reminder
// was removed as noise — experienced PMs already know the convention.
const FurnitureLayoutBanner = ({ tasks }) => {
  const furnitureTask = tasks.find((t) => t.taskType === 'furniture_layout');
  if (!furnitureTask) return null;

  const isApproved = ['approved', 'released_to_site', 'completed'].includes(furnitureTask.status);
  if (!isApproved) return null;

  return (
    <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl
                    bg-[var(--accent-green)]/8 border border-[var(--accent-green)]/25">
      <CheckCircle2 size={15} className="text-[var(--accent-green)] shrink-0" />
      <p className="text-xs text-[var(--accent-green)] font-semibold">
        Furniture Layout approved — all design sub-tasks (AC, Kitchen, Bathroom, Technical, Concept) can now be assigned.
      </p>
    </div>
  );
};

const TasksTab = ({ project, tasks, onTaskCreated, onTaskUpdated }) => {
  const [showCreate, setShowCreate] = useState(false);
  const [view, setView] = useState('list');

  return (
    <div className="space-y-4">
      <FurnitureLayoutBanner tasks={tasks} />

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-[var(--text-muted)]">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-[var(--border)] rounded-xl overflow-hidden">
            <button
              onClick={() => setView('list')}
              className={`p-2 transition-colors ${view === 'list' ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
              title="List view"
            >
              <List size={14} />
            </button>
            <button
              onClick={() => setView('kanban')}
              className={`p-2 transition-colors ${view === 'kanban' ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
              title="Kanban view"
            >
              <LayoutGrid size={14} />
            </button>
          </div>
          <PermissionGate permission="tasks.create">
            <Button onClick={() => setShowCreate(true)}>
              <Plus size={15} className="mr-1" /> Add Task
            </Button>
          </PermissionGate>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <p className="text-sm">No tasks yet.</p>
          <p className="text-xs mt-1">Add the first task to get started.</p>
        </div>
      ) : view === 'kanban' ? (
        <KanbanBoard tasks={tasks} onTaskUpdated={onTaskUpdated} />
      ) : (
        <ListView tasks={tasks} onTaskUpdated={onTaskUpdated} />
      )}

      <CreateTaskModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        projectId={project._id}
        onCreated={onTaskCreated}
      />
    </div>
  );
};

export default TasksTab;
