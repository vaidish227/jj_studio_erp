import React, { useState } from 'react';
import { UserCheck, X } from 'lucide-react';
import { Button } from '../../../shared/components';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';
import EmployeePicker from './EmployeePicker';

const PRIORITIES = [
  { value: 'low',    label: 'Low',    color: 'text-[var(--success)]' },
  { value: 'medium', label: 'Medium', color: 'text-[var(--accent-blue)]' },
  { value: 'high',   label: 'High',   color: 'text-[var(--warning)]' },
  { value: 'urgent', label: 'Urgent', color: 'text-[var(--error)]' },
];

const toDateInput = (val) => {
  if (!val) return '';
  return new Date(val).toISOString().slice(0, 10);
};

const ReassignTaskModal = ({ task, isOpen, onClose, onReassigned }) => {
  const toast = useToast();
  const [assignedTo, setAssignedTo]     = useState('');
  const [reason, setReason]             = useState('');
  const [priority, setPriority]         = useState('');
  const [startDate, setStartDate]       = useState('');
  const [dueDate, setDueDate]           = useState('');
  const [notifyMail, setNotifyMail]     = useState(true);
  const [notifyWA, setNotifyWA]         = useState(false);
  const [saving, setSaving]             = useState(false);
  const [errors, setErrors]             = useState({});

  // Pre-fill from task whenever modal opens
  React.useEffect(() => {
    if (isOpen && task) {
      setPriority(task.priority || '');
      setStartDate(toDateInput(task.startDate));
      setDueDate(toDateInput(task.dueDate));
    }
  }, [isOpen, task]);

  if (!isOpen || !task) return null;

  const validate = () => {
    const e = {};
    if (!assignedTo) e.assignedTo = 'Please select a designer';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await pmsService.reassignTask(task._id, {
        assignedTo: assignedTo._id,
        reassignedReason: reason.trim(),
        ...(priority  && { priority }),
        ...(startDate && { startDate }),
        ...(dueDate   && { dueDate }),
        notifyMail,
        notifyWhatsApp: notifyWA,
      });
      toast.success('Task reassigned successfully');
      onReassigned?.(res.task);
      handleClose();
    } catch (e) {
      toast.error(e?.message || 'Failed to reassign task');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setAssignedTo('');
    setReason('');
    setPriority('');
    setStartDate('');
    setDueDate('');
    setNotifyMail(true);
    setNotifyWA(false);
    setErrors({});
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-blue)]/15 flex items-center justify-center">
              <UserCheck size={16} className="text-[var(--accent-blue)]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Reassign Task</h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate max-w-[220px]">{task.title}</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mt-0.5">
            <X size={18} />
          </button>
        </div>

        {task.assignedTo && (
          <div className="mb-4 px-3 py-2 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-secondary)]">
            Currently assigned to{' '}
            <span className="font-bold text-[var(--text-primary)]">
              {task.assignedTo?.name || 'Unknown'}
            </span>
          </div>
        )}

        <div className="space-y-4">
          {/* New assignee */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[var(--text-secondary)]">
              Assign To <span className="text-[var(--error)]">*</span>
            </label>
            <EmployeePicker
              value={assignedTo}
              onChange={(v) => { setAssignedTo(v); setErrors((p) => ({ ...p, assignedTo: '' })); }}
              placeholder="Search designers…"
              filterRoles={['designer', 'manager', 'admin']}
            />
            {errors.assignedTo && (
              <p className="text-[11px] text-[var(--error)]">{errors.assignedTo}</p>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[var(--text-secondary)]">
              Reason for Reassignment <span className="font-normal text-[var(--text-muted)]">(optional)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="e.g. Workload balancing, skill match, availability…"
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg)]
                         text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                         focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)] resize-none"
            />
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[var(--text-secondary)]">Priority</label>
            <div className="flex gap-2 flex-wrap">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(priority === p.value ? '' : p.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors
                    ${priority === p.value
                      ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                      : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text-secondary)] hover:border-[var(--primary)]/40'
                    }`}
                >
                  <span className={p.color}>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[var(--text-secondary)]">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg)]
                           text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[var(--text-secondary)]">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg)]
                           text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
              />
            </div>
          </div>

          {/* Notifications */}
          {assignedTo && (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-semibold text-[var(--text-secondary)]">Notify new assignee</p>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={notifyMail}
                  onChange={(e) => setNotifyMail(e.target.checked)}
                  className="rounded accent-[var(--primary)]"
                />
                <span className="text-xs text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                  Send email notification
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={notifyWA}
                  onChange={(e) => setNotifyWA(e.target.checked)}
                  className="rounded accent-[var(--primary)]"
                />
                <span className="text-xs text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                  Send WhatsApp notification
                </span>
              </label>
            </div>
          )}
        </div>

        <p className="text-[11px] text-[var(--text-muted)] mt-4 mb-5 leading-relaxed">
          Task status will be reset to <strong>Not Started</strong>. Any pending submissions will be cleared.
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={handleClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !assignedTo}>
            <UserCheck size={14} className="mr-1.5" />
            {saving ? 'Reassigning…' : 'Reassign Task'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReassignTaskModal;
