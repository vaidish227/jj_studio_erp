import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Modal from '../../../shared/components/Modal/Modal';
import FormField from '../../../shared/components/FormField/FormField';
import Button from '../../../shared/components/Button/Button';
import { useAuth } from '../../../shared/context/AuthContext';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { delegationService } from '../services/delegationService';
import { departmentService } from '../services/departmentService';
import { PRIORITIES, PRIORITY_META } from '../constants/delegationStatus';
import { PRIORITY_ACCENT } from './delegationFormat';

const inputCls =
  'w-full border border-[var(--border)] bg-[var(--surface)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30';

const CreateDelegationModal = ({ isOpen, onClose, onCreated }) => {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const canAssign = hasPermission('delegation.assign');

  const [form, setForm] = useState({
    title: '', description: '', departmentId: '', priority: 'medium', assignedTo: '', dueDate: '',
  });
  const [checklist, setChecklist] = useState([]);
  const [newItem, setNewItem] = useState('');
  const [departments, setDepartments] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setForm({ title: '', description: '', departmentId: '', priority: 'medium', assignedTo: '', dueDate: '' });
    setChecklist([]); setNewItem(''); setError('');
    departmentService.list({ active: true }).then((r) => setDepartments(r.departments || [])).catch(() => {});
    if (canAssign) {
      delegationService.assignees().then((r) => setAssignees(r.users || [])).catch(() => {});
    }
  }, [isOpen, canAssign]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const addItem = () => {
    const v = newItem.trim();
    if (!v) return;
    setChecklist((c) => [...c, v]);
    setNewItem('');
  };

  const submit = async () => {
    if (!form.title.trim() || form.title.trim().length < 3) {
      setError('Title is required (min 3 characters).');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        departmentId: form.departmentId || undefined,
        priority: form.priority,
        assignedTo: canAssign && form.assignedTo ? form.assignedTo : undefined,
        dueDate: form.dueDate || undefined,
        checklist: checklist.map((item) => ({ item })),
      };
      const res = await delegationService.create(payload);
      toast.success('Delegation created');
      onCreated?.(res.delegation);
      onClose?.();
    } catch (err) {
      setError(err?.message || 'Failed to create delegation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Delegation">
      <div className="space-y-4">
        {error && (
          <div className="text-sm text-[var(--error)] bg-[var(--error)]/10 border border-[var(--error)]/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <FormField label="Title" required>
          <input className={inputCls} value={form.title} onChange={set('title')} placeholder="e.g. 3D render — master bedroom" />
        </FormField>
        <FormField label="Description">
          <textarea className={inputCls} rows={2} value={form.description} onChange={set('description')} placeholder="Details…" />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Department">
            <select className={inputCls} value={form.departmentId} onChange={set('departmentId')}>
              <option value="">— none (optional) —</option>
              {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
            {departments.length === 0 && (
              <p className="text-[11px] text-[var(--text-muted)] mt-1">No departments configured yet — add them under Departments.</p>
            )}
          </FormField>
          <FormField label="Priority">
            <div className="grid grid-cols-4 gap-1.5">
              {PRIORITIES.map((p) => {
                const active = form.priority === p;
                const accent = PRIORITY_ACCENT[p] || 'var(--text-muted)';
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, priority: p }))}
                    className="rounded-xl border px-2 py-2 text-xs font-bold transition-all"
                    style={
                      active
                        ? { borderColor: accent, color: accent, background: `color-mix(in srgb, ${accent} 12%, transparent)` }
                        : { borderColor: 'var(--border)', color: 'var(--text-muted)' }
                    }
                  >
                    {PRIORITY_META[p].label}
                  </button>
                );
              })}
            </div>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {canAssign && (
            <FormField label="Assign to">
              <select className={inputCls} value={form.assignedTo} onChange={set('assignedTo')}>
                <option value="">— unassigned —</option>
                {assignees.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.role})</option>)}
              </select>
            </FormField>
          )}
          <FormField label="Due date">
            <input type="date" className={inputCls} value={form.dueDate} onChange={set('dueDate')} />
          </FormField>
        </div>

        <FormField label="Checklist">
          <div className="flex gap-2">
            <input
              className={inputCls}
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
              placeholder="Add a checklist item and press Enter"
            />
            <button type="button" onClick={addItem} className="px-3 rounded-xl border border-[var(--border)] hover:bg-[var(--bg)]">
              <Plus size={16} />
            </button>
          </div>
          {checklist.length > 0 && (
            <ul className="mt-2 space-y-1">
              {checklist.map((item, i) => (
                <li key={i} className="flex items-center justify-between text-sm bg-[var(--bg)] rounded-lg px-3 py-1.5">
                  <span>{item}</span>
                  <button type="button" onClick={() => setChecklist((c) => c.filter((_, j) => j !== i))} className="text-[var(--text-muted)] hover:text-[var(--error)]">
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </FormField>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" isLoading={saving} onClick={submit}>Create Delegation</Button>
        </div>
      </div>
    </Modal>
  );
};

export default CreateDelegationModal;
