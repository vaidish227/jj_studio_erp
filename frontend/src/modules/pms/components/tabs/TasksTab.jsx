import React, { useState } from 'react';
import { Plus, List, LayoutGrid } from 'lucide-react';
import { Button } from '../../../../shared/components';
import PermissionGate from '../../../../shared/components/PermissionGate/PermissionGate';
import TaskCard from '../TaskCard';
import CreateTaskModal from '../CreateTaskModal';
import { TASK_TYPE_CONFIG } from '../TaskTypeIcon';

const KANBAN_COLUMNS = [
  { id: 'not_started', label: 'Not Started', color: 'text-[var(--text-muted)]',  bg: 'bg-[var(--border)]',            border: 'border-[var(--border)]' },
  { id: 'in_progress', label: 'In Progress',  color: 'text-[var(--accent-blue)]', bg: 'bg-[var(--accent-blue)]/10',    border: 'border-[var(--accent-blue)]/30' },
  { id: 'on_hold',     label: 'On Hold',      color: 'text-[var(--warning)]',     bg: 'bg-[var(--warning)]/10',        border: 'border-[var(--warning)]/30' },
  { id: 'completed',   label: 'Completed',    color: 'text-[var(--success)]',     bg: 'bg-[var(--success)]/10',        border: 'border-[var(--success)]/30' },
];

const KanbanBoard = ({ tasks, onTaskUpdated }) => {
  const byStatus = tasks.reduce((acc, t) => {
    const key = t.status || 'not_started';
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {KANBAN_COLUMNS.map((col) => {
        const colTasks = byStatus[col.id] || [];
        return (
          <div key={col.id} className={`rounded-2xl border ${col.border} bg-[var(--bg)] flex flex-col min-h-[200px]`}>
            <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-2xl ${col.bg}`}>
              <span className={`text-xs font-black uppercase tracking-wider ${col.color}`}>{col.label}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${col.bg} ${col.color}`}>
                {colTasks.length}
              </span>
            </div>
            <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[60vh]">
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
      {Object.entries(grouped).map(([type, typeTasks]) => {
        const cfg = TASK_TYPE_CONFIG[type];
        return (
          <div key={type}>
            <div className="flex items-center gap-2 mb-3">
              {cfg && (
                <div className={`w-5 h-5 rounded flex items-center justify-center ${cfg.bg}`}>
                  <cfg.Icon size={12} className={cfg.color} />
                </div>
              )}
              <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)]">
                {cfg?.label || type}
              </h3>
              <span className="text-[10px] font-bold text-[var(--text-muted)] ml-auto">{typeTasks.length}</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {typeTasks.map((task) => (
                <TaskCard key={task._id} task={task} onUpdated={onTaskUpdated} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const TasksTab = ({ project, tasks, onTaskCreated, onTaskUpdated }) => {
  const [showCreate, setShowCreate] = useState(false);
  const [view, setView] = useState('list');

  return (
    <div className="space-y-4">
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
