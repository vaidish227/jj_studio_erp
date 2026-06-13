import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, GripVertical, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import { Modal, Button, FormField, Input, Select, Loader } from '../../../shared/components';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../shared/services/pmsService';
import { useAuth } from '../../../shared/context/AuthContext';

/**
 * ChecklistTemplatesPage — Phase 3b.
 *
 * Settings → Checklist Templates.
 * Lets admins edit the per-task-type checklist templates without touching code.
 * Snapshot semantics preserved on the backend — editing a template does not
 * retroactively change existing tasks.
 *
 * Only one template per taskType can be `isDefault = true`. Editor enforces this.
 */

const TaskTypeBadge = ({ type }) => (
  <span className="inline-block text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text-muted)]">
    {type}
  </span>
);

// ── Editor modal ─────────────────────────────────────────────────────────────
const EditorModal = ({ template, isOpen, onClose, onSaved }) => {
  const toast = useToast();
  const isEdit = !!template;
  const [form, setForm] = useState({
    name: '',
    taskType: '',
    description: '',
    items: [{ label: '', order: 1 }],
    isDefault: true,
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (template) {
      setForm({
        name: template.name,
        taskType: template.taskType,
        description: template.description || '',
        items: (template.items || []).map((i, idx) => ({ label: i.label, order: i.order ?? idx + 1 })),
        isDefault: template.isDefault,
        isActive: template.isActive,
      });
    } else {
      setForm({ name: '', taskType: '', description: '', items: [{ label: '', order: 1 }], isDefault: true, isActive: true });
    }
  }, [isOpen, template?._id]);

  const setItem = (idx, label) => {
    setForm((f) => {
      const next = [...f.items];
      next[idx] = { ...next[idx], label };
      return { ...f, items: next };
    });
  };
  const addItem = () => {
    setForm((f) => ({ ...f, items: [...f.items, { label: '', order: f.items.length + 1 }] }));
  };
  const removeItem = (idx) => {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx).map((it, i) => ({ ...it, order: i + 1 })) }));
  };
  const moveItem = (idx, dir) => {
    setForm((f) => {
      const next = [...f.items];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return f;
      [next[idx], next[j]] = [next[j], next[idx]];
      return { ...f, items: next.map((it, i) => ({ ...it, order: i + 1 })) };
    });
  };

  const handleSubmit = async () => {
    const items = form.items.map((i) => ({ label: i.label.trim(), order: i.order })).filter((i) => i.label.length > 0);
    if (items.length === 0) { toast.error('Add at least one item'); return; }
    if (!isEdit) {
      if (!form.name.trim() || !form.taskType.trim()) { toast.error('Name and task type required'); return; }
    }
    setSubmitting(true);
    try {
      if (isEdit) {
        await pmsService.updateChecklistTemplate(template._id, {
          description: form.description,
          items,
          isDefault: form.isDefault,
          isActive: form.isActive,
        });
        toast.success('Template updated');
      } else {
        await pmsService.createChecklistTemplate({
          name: form.name.trim(),
          taskType: form.taskType.trim(),
          description: form.description,
          items,
          isDefault: form.isDefault,
          isActive: form.isActive,
        });
        toast.success('Template created');
      }
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? `Edit: ${template.name}` : 'New Checklist Template'} className="max-w-2xl">
      <div className="space-y-4">
        {!isEdit && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Template Name" required>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. kitchen_drawing_v2" />
            </FormField>
            <FormField label="Task Type" required>
              <Input value={form.taskType} onChange={(e) => setForm((f) => ({ ...f, taskType: e.target.value }))} placeholder="e.g. kitchen_drawing" />
            </FormField>
          </div>
        )}

        <FormField label="Description">
          <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What this checklist covers…" />
        </FormField>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-black uppercase tracking-widest text-[var(--text-secondary)]">Items</label>
            <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs text-[var(--primary)] hover:underline">
              <Plus size={12} /> Add item
            </button>
          </div>
          <div className="space-y-2">
            {form.items.map((it, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-[10px] font-black w-6 text-center text-[var(--text-muted)]">{idx + 1}</span>
                <Input
                  value={it.label}
                  onChange={(e) => setItem(idx, e.target.value)}
                  placeholder={`Step ${idx + 1}`}
                  className="flex-1"
                />
                <button type="button" onClick={() => moveItem(idx, -1)} className="px-1 text-[var(--text-muted)] hover:text-[var(--primary)]" title="Move up">↑</button>
                <button type="button" onClick={() => moveItem(idx, 1)} className="px-1 text-[var(--text-muted)] hover:text-[var(--primary)]" title="Move down">↓</button>
                <button type="button" onClick={() => removeItem(idx)} className="p-1.5 rounded-lg text-[var(--error)] hover:bg-[var(--error)]/10" title="Remove">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-[var(--border)]">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} className="w-4 h-4 accent-[var(--primary)]" />
            <span className="text-sm text-[var(--text-primary)]">Default for this task type</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4 accent-[var(--primary)]" />
            <span className="text-sm text-[var(--text-primary)]">Active</span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={submitting}>
            <Save size={13} className="mr-1.5" /> {isEdit ? 'Save Changes' : 'Create Template'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// ── Main page ────────────────────────────────────────────────────────────────
const ChecklistTemplatesPage = () => {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [taskTypeFilter, setTaskTypeFilter] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const canManage = hasPermission('settings.checklists.manage');

  const load = async () => {
    setLoading(true);
    try {
      const res = await pmsService.listChecklistTemplates({ taskType: taskTypeFilter || undefined, search: search || undefined });
      setTemplates(res.templates || []);
    } catch (err) {
      toast.error(err?.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [taskTypeFilter, search]);

  const handleDelete = async (t) => {
    if (!window.confirm(`Delete template "${t.name}"? Existing tasks remain unaffected.`)) return;
    try {
      await pmsService.deleteChecklistTemplate(t._id);
      toast.success('Template deleted');
      load();
    } catch (err) {
      toast.error(err?.message || 'Failed');
    }
  };

  // Group by taskType for display
  const grouped = templates.reduce((acc, t) => {
    (acc[t.taskType] = acc[t.taskType] || []).push(t);
    return acc;
  }, {});

  if (!canManage) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle size={20} className="mx-auto mb-2 text-[var(--warning)]" />
        <p className="text-sm text-[var(--text-muted)]">You need the <code>settings.checklists.manage</code> permission to access this page.</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl lg:text-2xl font-extrabold text-[var(--text-primary)]">Checklist Templates</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Edit per-task-type checklists. Existing tasks keep their snapshot — only new tasks get the updated items.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setEditorOpen(true); }}>
          <Plus size={13} className="mr-1.5" /> New Template
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name…" className="flex-1" />
        <Input value={taskTypeFilter} onChange={(e) => setTaskTypeFilter(e.target.value)} placeholder="Filter by task type…" className="sm:max-w-xs" />
      </div>

      {loading && <p className="text-sm text-[var(--text-muted)] text-center py-6">Loading…</p>}

      {!loading && templates.length === 0 && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">No templates found.</p>
        </div>
      )}

      {Object.entries(grouped).map(([taskType, list]) => (
        <div key={taskType} className="space-y-2">
          <div className="flex items-center gap-2">
            <TaskTypeBadge type={taskType} />
            <span className="text-[10px] text-[var(--text-muted)]">{list.length} template(s)</span>
          </div>
          <div className="space-y-2">
            {list.map((t) => (
              <div key={t._id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 flex items-center gap-3 hover:border-[var(--primary)]/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-[var(--text-primary)]">{t.name}</p>
                    {t.isDefault && (
                      <span className="text-[9px] font-black uppercase tracking-widest text-[var(--success)] bg-[var(--success)]/12 px-1.5 py-0.5 rounded">DEFAULT</span>
                    )}
                    {!t.isActive && (
                      <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] bg-[var(--bg)] border border-[var(--border)] px-1.5 py-0.5 rounded">INACTIVE</span>
                    )}
                    <span className="text-[10px] text-[var(--text-muted)]">{t.items?.length || 0} items</span>
                  </div>
                  {t.description && <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{t.description}</p>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(t); setEditorOpen(true); }}>
                  <Edit2 size={12} className="mr-1" /> Edit
                </Button>
                {!t.isDefault && (
                  <button type="button" onClick={() => handleDelete(t)} className="p-1.5 rounded-lg text-[var(--error)] hover:bg-[var(--error)]/10" title="Delete">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <EditorModal
        template={editing}
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSaved={load}
      />
    </div>
  );
};

export default ChecklistTemplatesPage;
