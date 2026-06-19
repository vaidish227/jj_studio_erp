import React, { useState } from 'react';
import { Plus, Flag, CheckCircle2, Clock, AlertCircle, Calendar, Trash2, Edit2 } from 'lucide-react';
import { Button, Modal, Loader } from '../../../../shared/components';
import PermissionGate from '../../../../shared/components/PermissionGate/PermissionGate';
import { useToast } from '../../../../shared/notifications/ToastProvider';
import useMilestones from '../../hooks/useMilestones';

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const STATUS_CONFIG = {
  pending:     { label: 'Pending',     color: 'text-[var(--text-muted)]',    bg: 'bg-[var(--border)]',             icon: Clock },
  in_progress: { label: 'In Progress', color: 'text-[var(--accent-blue)]',   bg: 'bg-[var(--accent-blue)]/10',    icon: Clock },
  completed:   { label: 'Completed',   color: 'text-[var(--success)]',       bg: 'bg-[var(--success)]/10',        icon: CheckCircle2 },
  delayed:     { label: 'Delayed',     color: 'text-[var(--error)]',         bg: 'bg-[var(--error)]/10',          icon: AlertCircle },
};

const MilestoneBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
      <Icon size={10} /> {cfg.label}
    </span>
  );
};

const EMPTY_FORM = { title: '', description: '', dueDate: '', isCritical: false, status: 'pending' };

const MilestoneFormModal = ({ isOpen, onClose, onSave, initial = EMPTY_FORM, title }) => {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  const handle = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.title.trim() || !form.dueDate) return;
    setSaving(true);
    try { await onSave(form); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Title *</label>
          <input
            value={form.title}
            onChange={(e) => handle('title', e.target.value)}
            placeholder="Milestone title"
            className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Due Date *</label>
          <input
            type="date"
            value={form.dueDate ? form.dueDate.substring(0, 10) : ''}
            onChange={(e) => handle('dueDate', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Status</label>
          <select
            value={form.status}
            onChange={(e) => handle('status', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="delayed">Delayed</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => handle('description', e.target.value)}
            placeholder="Optional details..."
            rows={2}
            className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isCritical}
            onChange={(e) => handle('isCritical', e.target.checked)}
            className="rounded"
          />
          <span className="text-sm text-[var(--text-secondary)]">Mark as critical milestone</span>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!form.title.trim() || !form.dueDate || saving}>
            {saving ? 'Saving…' : 'Save Milestone'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

const MilestonesTab = ({ project }) => {
  const { success, error: toastError } = useToast();
  const { milestones, isLoading, error, createMilestone, updateMilestone, deleteMilestone } = useMilestones(project._id);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing]       = useState(null);

  const handleCreate = async (data) => {
    try { await createMilestone(data); success('Milestone created'); }
    catch (e) { toastError(e || 'Failed to create milestone'); }
  };

  const handleUpdate = async (data) => {
    try { await updateMilestone(editing._id, data); success('Milestone updated'); setEditing(null); }
    catch (e) { toastError(e || 'Failed to update milestone'); }
  };

  const handleDelete = async (id) => {
    try { await deleteMilestone(id); success('Milestone deleted'); }
    catch (e) { toastError(e || 'Failed to delete milestone'); }
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader label="Loading milestones…" /></div>;
  if (error) return <div className="text-sm text-[var(--error)] py-8 text-center">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">
          Milestones <span className="text-[var(--text-muted)] font-normal">({milestones.length})</span>
        </h3>
        <PermissionGate permission="milestones.create">
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> Add Milestone
          </Button>
        </PermissionGate>
      </div>

      {milestones.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center mb-3">
            <Flag size={22} className="text-[var(--primary)]" />
          </div>
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">No milestones yet</p>
          <p className="text-xs text-[var(--text-muted)] mb-4">Add milestones to track key project checkpoints.</p>
          <PermissionGate permission="milestones.create">
            <Button size="sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Add First Milestone</Button>
          </PermissionGate>
        </div>
      ) : (
        <div className="relative pl-5 space-y-0">
          {/* Vertical timeline line */}
          <div className="absolute left-2 top-2 bottom-2 w-px bg-[var(--border)]" />
          {milestones.map((m) => {
            const isOverdue = m.status !== 'completed' && m.dueDate && new Date(m.dueDate) < new Date();
            return (
              <div key={m._id} className="relative flex gap-4 pb-6 last:pb-0">
                {/* Dot */}
                <div className={`absolute -left-3.5 w-3 h-3 rounded-full border-2 border-[var(--surface)] mt-1.5
                  ${m.status === 'completed' ? 'bg-[var(--success)]' : m.isCritical ? 'bg-[var(--error)]' : 'bg-[var(--primary)]'}`}
                />
                <div className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 hover:border-[var(--primary)]/40 transition-colors">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-bold text-[var(--text-primary)]">{m.title}</p>
                        {m.isCritical && (
                          <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-[var(--error)]/10 text-[var(--error)]">
                            Critical
                          </span>
                        )}
                        {m.sourcePhase && (
                          <span
                            className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]"
                            title="Auto-synced from the master-sheet phase — recalculate the schedule to refresh."
                          >
                            Phase
                          </span>
                        )}
                        <MilestoneBadge status={m.status} />
                        {m.sourcePhase && typeof m.progressPercent === 'number' && (
                          <span className="text-[10px] font-bold text-[var(--text-muted)]">{m.progressPercent}%</span>
                        )}
                      </div>
                      {m.description && (
                        <p className="text-xs text-[var(--text-muted)] mb-2">{m.description}</p>
                      )}
                      <div className="flex items-center gap-1 text-xs">
                        <Calendar size={11} className={isOverdue ? 'text-[var(--error)]' : 'text-[var(--text-muted)]'} />
                        <span className={isOverdue ? 'text-[var(--error)] font-semibold' : 'text-[var(--text-muted)]'}>
                          {m.startDate ? `${fmt(m.startDate)} → ` : ''}{fmt(m.dueDate)}{isOverdue ? ' — Overdue' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <PermissionGate permission="milestones.update">
                        <button
                          onClick={() => setEditing(m)}
                          className="p-1.5 rounded-lg hover:bg-[var(--bg)] text-[var(--text-muted)] transition-colors"
                        >
                          <Edit2 size={13} />
                        </button>
                      </PermissionGate>
                      <PermissionGate permission="milestones.delete">
                        <button
                          onClick={() => handleDelete(m._id)}
                          className="p-1.5 rounded-lg hover:bg-[var(--error)]/10 text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </PermissionGate>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <MilestoneFormModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSave={handleCreate}
        title="Add Milestone"
      />
      {editing && (
        <MilestoneFormModal
          isOpen={!!editing}
          onClose={() => setEditing(null)}
          onSave={handleUpdate}
          initial={{ title: editing.title, description: editing.description || '', dueDate: editing.dueDate?.substring(0,10) || '', isCritical: editing.isCritical, status: editing.status }}
          title="Edit Milestone"
        />
      )}
    </div>
  );
};

export default MilestonesTab;
