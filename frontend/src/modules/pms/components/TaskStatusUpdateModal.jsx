import React, { useState, useEffect } from 'react';
import { PauseCircle, Play, X, AlertCircle } from 'lucide-react';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';

const ACTION_CONFIG = {
  on_hold: {
    title: 'Put Task On Hold',
    icon: PauseCircle,
    color: 'var(--warning)',
    label: 'Why are you putting this task on hold?',
    placeholder: 'e.g. Waiting for client approval on material selection, vendor quotation pending…',
    required: true,
    btnLabel: 'Put On Hold',
    btnClass: 'bg-[var(--warning)] hover:bg-[var(--warning)]/90 text-black',
  },
  in_progress: {
    title: 'Resume Task',
    icon: Play,
    color: 'var(--accent-blue)',
    label: 'Add a note (optional)',
    placeholder: 'e.g. Resuming after client confirmation…',
    required: false,
    btnLabel: 'Resume Task',
    btnClass: 'bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 text-white',
  },
};

const TaskStatusUpdateModal = ({ isOpen, onClose, task, targetStatus, onUpdated }) => {
  const toast = useToast();
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving]   = useState(false);

  const cfg = ACTION_CONFIG[targetStatus];

  useEffect(() => {
    if (isOpen) setRemarks('');
  }, [isOpen]);

  if (!isOpen || !cfg || !task) return null;

  const IconComp = cfg.icon;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cfg.required && !remarks.trim()) return;
    setSaving(true);
    try {
      const payload = { status: targetStatus };
      if (targetStatus === 'on_hold' && remarks.trim()) payload.holdReason = remarks.trim();
      if (targetStatus === 'in_progress' && remarks.trim()) payload.notes = remarks.trim();
      await pmsService.updateTask(task._id, payload);
      toast.success(targetStatus === 'on_hold' ? 'Task put on hold' : 'Task resumed');
      onUpdated?.();
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Failed to update task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md shadow-2xl">

        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-[var(--border)]">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `color-mix(in srgb, ${cfg.color} 12%, transparent)` }}
          >
            <IconComp size={18} style={{ color: cfg.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-extrabold text-[var(--text-primary)]">{cfg.title}</h2>
            <p className="text-xs text-[var(--text-muted)] truncate">{task.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-[var(--border)] flex items-center justify-center text-[var(--text-muted)] transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* Task context */}
          <div className="px-3 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)]">
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-1">Task</p>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{task.title}</p>
            {task.projectId?.name && (
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{task.projectId.name}</p>
            )}
          </div>

          {/* Remarks field */}
          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
              {cfg.label}
              {cfg.required && <span className="text-[var(--error)] ml-0.5">*</span>}
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={cfg.placeholder}
              rows={3}
              required={cfg.required}
              className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)]
                         text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                         focus:outline-none focus:border-[var(--primary)] resize-none"
            />
            {cfg.required && !remarks.trim() && (
              <p className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] mt-1">
                <AlertCircle size={11} />
                A reason is required before putting a task on hold.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border)] text-sm font-semibold
                         text-[var(--text-secondary)] hover:bg-[var(--border)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || (cfg.required && !remarks.trim())}
              className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed ${cfg.btnClass}`}
            >
              {saving ? 'Saving…' : cfg.btnLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskStatusUpdateModal;
