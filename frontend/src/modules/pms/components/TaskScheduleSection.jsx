import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ListTree, Plus, History as HistoryIcon, Lock, Clock, Pencil, Trash2 } from 'lucide-react';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';
import TaskStatusBadge from './TaskStatusBadge';
import SubtaskModal from './planner/SubtaskModal';
import ShiftHistoryModal from './planner/ShiftHistoryModal';

const fmt = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
  : '—';

const Field = ({ label, children, accent }) => (
  <div className="rounded-xl bg-[var(--bg)]/60 border border-[var(--border)] px-3.5 py-3">
    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">{label}</p>
    <p className="text-sm font-bold" style={{ color: accent || 'var(--text-primary)' }}>{children}</p>
  </div>
);

/**
 * TaskScheduleSection — schedule panel + nested subtasks for a single task on the
 * Task Detail page. Reuses the planner SubtaskModal + ShiftHistoryModal so the UX
 * matches the Master Sheet.
 */
const TaskScheduleSection = ({ task, projectId, canEdit, onRefresh }) => {
  const toast = useToast();
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(false);
  const [subtaskModal, setSubtaskModal] = useState({ open: false, mode: 'create', subtask: null });
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadChildren = useCallback(() => {
    if (!projectId || !task?._id) return;
    setLoading(true);
    pmsService.getTasksByProject(projectId)
      .then((res) => {
        const all = res?.tasks || [];
        setChildren(all.filter((t) => String(t.parentTaskId || '') === String(task._id)));
      })
      .catch(() => setChildren([]))
      .finally(() => setLoading(false));
  }, [projectId, task?._id]);

  useEffect(() => { loadChildren(); }, [loadChildren]);

  const planning = task.planning || {};

  const handleSubmit = useCallback(async (payload) => {
    setBusy(true);
    try {
      if (subtaskModal.mode === 'edit' && subtaskModal.subtask) {
        await pmsService.updateSubtask(subtaskModal.subtask._id, payload);
        toast.success('Subtask updated');
      } else {
        await pmsService.createSubtask(projectId, task._id, payload);
        toast.success('Subtask added');
      }
      setSubtaskModal({ open: false, mode: 'create', subtask: null });
      loadChildren();
      onRefresh?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to save subtask');
    } finally {
      setBusy(false);
    }
  }, [subtaskModal, projectId, task?._id, loadChildren, onRefresh, toast]);

  const handleDelete = useCallback(async (sub) => {
    if (!window.confirm(`Delete subtask "${sub.title}"?`)) return;
    try {
      await pmsService.deletePlannerRow(sub._id);
      toast.success('Subtask deleted');
      loadChildren();
      onRefresh?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to delete subtask');
    }
  }, [loadChildren, onRefresh, toast]);

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 space-y-4">
      {/* Schedule panel */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-[var(--primary)]/14">
            <Calendar size={13} className="text-[var(--primary)]" />
          </div>
          <p className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)]">Schedule</p>
          <div className="ml-auto flex items-center gap-2">
            {task.scheduleLocked && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--warning)]">
                <Lock size={11} /> Locked
              </span>
            )}
            {task.shiftCount > 0 && (
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--accent-blue)] hover:underline"
              >
                <Clock size={12} /> Shifted ×{task.shiftCount}
              </button>
            )}
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent-blue)] hover:bg-[var(--bg)]"
              title="Shift history"
            >
              <HistoryIcon size={13} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <Field label="Planned Start">{fmt(planning.plannedStartDate)}</Field>
          <Field label="Planned Due">{fmt(planning.plannedEndDate)}</Field>
          <Field label="Duration">{task.durationDays != null ? `${task.durationDays} day(s)` : '—'}</Field>
          <Field label="Actual Start">{fmt(task.startDate)}</Field>
          <Field label="Actual Completion">{fmt(task.completedAt)}</Field>
          {task.delayReason && <Field label="Delay Reason" accent="var(--warning)">{task.delayReason}</Field>}
        </div>
      </div>

      {/* Subtasks */}
      <div className="pt-3 border-t border-[var(--border)]">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-[var(--accent-blue)]/14">
            <ListTree size={13} className="text-[var(--accent-blue)]" />
          </div>
          <p className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)]">Subtasks</p>
          {children.length > 0 && <span className="text-xs font-bold text-[var(--text-muted)]">{children.length}</span>}
          {canEdit && !task.isSubtask && (
            <button
              type="button"
              onClick={() => setSubtaskModal({ open: true, mode: 'create', subtask: null })}
              className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold text-[var(--primary)] bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20"
            >
              <Plus size={12} /> Add Subtask
            </button>
          )}
        </div>
        {loading ? (
          <p className="text-xs text-[var(--text-muted)] py-2">Loading…</p>
        ) : children.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] italic py-2">No subtasks.</p>
        ) : (
          <ul className="space-y-1.5">
            {children.map((sub) => (
              <li key={sub._id} className="flex items-center gap-3 rounded-xl bg-[var(--bg)]/60 border border-[var(--border)] px-3 py-2">
                <Link to={`/tasks/${sub._id}`} className="text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--primary)] truncate flex-1">
                  {sub.title}
                </Link>
                <TaskStatusBadge status={sub.status} />
                <span className="text-[11px] text-[var(--text-muted)] hidden sm:inline">{fmt(sub.planning?.plannedStartDate)} – {fmt(sub.planning?.plannedEndDate)}</span>
                {sub.assignedTo?.name && <span className="text-[11px] text-[var(--text-secondary)] hidden md:inline truncate max-w-[100px]">{sub.assignedTo.name}</span>}
                {canEdit && (
                  <div className="flex items-center gap-0.5">
                    <button type="button" onClick={() => setSubtaskModal({ open: true, mode: 'edit', subtask: sub })}
                      className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--bg)]" title="Edit subtask">
                      <Pencil size={12} />
                    </button>
                    <button type="button" onClick={() => handleDelete(sub)}
                      className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10" title="Delete subtask">
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <SubtaskModal
        open={subtaskModal.open}
        mode={subtaskModal.mode}
        subtask={subtaskModal.subtask}
        parentTitle={task.title}
        teamUserIds={null}
        busy={busy}
        onClose={() => !busy && setSubtaskModal({ open: false, mode: 'create', subtask: null })}
        onSubmit={handleSubmit}
      />
      <ShiftHistoryModal
        open={historyOpen}
        taskId={task._id}
        taskTitle={task.title}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
};

export default TaskScheduleSection;
