import { useState, useEffect } from 'react';
import {
  Plus, Trash2, Type, AlignLeft, Flag,
  UserRound, CalendarDays, ListChecks, ChevronDown, Check, AlertCircle,
} from 'lucide-react';
import Modal from '../../../shared/components/Modal/Modal';
import FormField from '../../../shared/components/FormField/FormField';
import Button from '../../../shared/components/Button/Button';
import { useAuth } from '../../../shared/context/AuthContext';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { delegationService } from '../services/delegationService';
import { PRIORITIES, PRIORITY_META } from '../constants/delegationStatus';
import { PRIORITY_ACCENT } from './delegationFormat';

// Shared field skin — a calm box that warms to a gold border + soft ring on
// focus (premium feel vs. a hard ring). Tokens keep it on-theme.
const FIELD =
  'w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-all duration-200 focus:outline-none focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/15';

// Label with a leading icon — passed as a node into FormField so we keep the
// shared required-asterisk / error behaviour but gain scannability.
const IconLabel = ({ icon: Icon, children }) => (
  <span className="inline-flex items-center gap-1.5">
    <Icon size={14} className="text-[var(--text-muted)]" />
    {children}
  </span>
);

// Positions a muted leading icon inside a field. `align="top"` for textareas.
const Affix = ({ icon: Icon, align = 'center' }) => (
  <span
    className={`pointer-events-none absolute left-3 text-[var(--text-muted)] ${
      align === 'top' ? 'top-3' : 'top-1/2 -translate-y-1/2'
    }`}
  >
    <Icon size={16} />
  </span>
);

const CreateDelegationModal = ({ isOpen, onClose, onCreated }) => {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const canAssign = hasPermission('delegation.assign');

  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium', assignedTo: '', dueDate: '',
  });
  const [checklist, setChecklist] = useState([]);
  const [newItem, setNewItem] = useState('');
  const [assignees, setAssignees] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setForm({ title: '', description: '', priority: 'medium', assignedTo: '', dueDate: '' });
    setChecklist([]); setNewItem(''); setError('');
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
      <div className="space-y-5">
        {error && (
          <div role="alert" className="flex items-start gap-2 text-sm text-[var(--error)] bg-[var(--error)]/10 border border-[var(--error)]/20 rounded-xl px-3 py-2.5">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── What ─────────────────────────────────────────────── */}
        <FormField label={<IconLabel icon={Type}>Title</IconLabel>} required>
          <div className="relative">
            <Affix icon={Type} />
            <input
              autoFocus
              className={`${FIELD} pl-10 pr-3.5 py-2.5`}
              value={form.title}
              onChange={set('title')}
              placeholder="e.g. 3D render — master bedroom"
            />
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mt-1.5 ml-0.5">Give it a clear, action-oriented name.</p>
        </FormField>

        <FormField label={<IconLabel icon={AlignLeft}>Description</IconLabel>}>
          <div className="relative">
            <Affix icon={AlignLeft} align="top" />
            <textarea
              className={`${FIELD} pl-10 pr-3.5 py-2.5 resize-y`}
              rows={3}
              value={form.description}
              onChange={set('description')}
              placeholder="Add context, references, or acceptance criteria…"
            />
          </div>
        </FormField>

        {/* ── Classification ───────────────────────────────────── */}
        <FormField label={<IconLabel icon={Flag}>Priority</IconLabel>}>
          <div className="grid grid-cols-4 gap-2">
            {PRIORITIES.map((p) => {
              const active = form.priority === p;
              const accent = PRIORITY_ACCENT[p] || 'var(--text-muted)';
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setForm((f) => ({ ...f, priority: p }))}
                  className="flex items-center justify-center gap-2 rounded-xl border px-2 py-2.5 text-xs font-bold transition-all duration-150 focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/15"
                  style={
                    active
                      ? { borderColor: accent, color: accent, background: `color-mix(in srgb, ${accent} 12%, transparent)`, boxShadow: `inset 0 0 0 1px ${accent}` }
                      : { borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--surface)' }
                  }
                >
                  {/* severity dot — always shows the option's colour so the
                      scale reads at a glance, even when not selected */}
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: accent, opacity: active ? 1 : 0.55 }} />
                  {PRIORITY_META[p].label}
                </button>
              );
            })}
          </div>
        </FormField>

        {/* ── Ownership ────────────────────────────────────────── */}
        <div className={`grid gap-4 ${canAssign ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
          {canAssign && (
            <FormField label={<IconLabel icon={UserRound}>Assign to</IconLabel>}>
              <div className="relative">
                <Affix icon={UserRound} />
                <select className={`${FIELD} pl-10 pr-9 py-2.5 appearance-none cursor-pointer`} value={form.assignedTo} onChange={set('assignedTo')}>
                  <option value="">— unassigned —</option>
                  {assignees.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.role})</option>)}
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              </div>
            </FormField>
          )}
          <FormField label={<IconLabel icon={CalendarDays}>Due date</IconLabel>}>
            <div className="relative">
              <Affix icon={CalendarDays} />
              <input type="date" className={`${FIELD} pl-10 pr-3.5 py-2.5 cursor-pointer`} value={form.dueDate} onChange={set('dueDate')} />
            </div>
          </FormField>
        </div>

        {/* ── Checklist ────────────────────────────────────────── */}
        <FormField
          label={
            <IconLabel icon={ListChecks}>
              Checklist
              {checklist.length > 0 && (
                <span className="ml-1 text-[10px] font-bold text-[var(--primary-active)] bg-[var(--primary)]/12 rounded-full px-1.5 py-0.5">
                  {checklist.length}
                </span>
              )}
            </IconLabel>
          }
        >
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Affix icon={ListChecks} />
              <input
                className={`${FIELD} pl-10 pr-3.5 py-2.5`}
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
                placeholder="Add a checklist item and press Enter"
              />
            </div>
            <button
              type="button"
              aria-label="Add checklist item"
              onClick={addItem}
              disabled={!newItem.trim()}
              className="shrink-0 w-11 flex items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--primary)]/10 hover:border-[var(--primary)] hover:text-[var(--primary-active)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-[var(--border)] disabled:hover:text-[var(--text-secondary)]"
            >
              <Plus size={18} />
            </button>
          </div>

          {checklist.length > 0 ? (
            <ul className="mt-2.5 space-y-1.5">
              {checklist.map((item, i) => (
                <li key={i} className="group flex items-center gap-2.5 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2">
                  <span className="w-4 h-4 rounded-full bg-[var(--primary)]/15 text-[var(--primary-active)] flex items-center justify-center shrink-0">
                    <Check size={11} strokeWidth={3} />
                  </span>
                  <span className="flex-1 text-[var(--text-primary)]">{item}</span>
                  <button
                    type="button"
                    aria-label="Remove checklist item"
                    onClick={() => setChecklist((c) => c.filter((_, j) => j !== i))}
                    className="text-[var(--text-muted)] hover:text-[var(--error)] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-[var(--text-muted)] mt-1.5 ml-0.5">Break the work into trackable sub-tasks (optional).</p>
          )}
        </FormField>

        {/* ── Footer ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 pt-4 mt-1 border-t border-[var(--border)]">
          <span className="text-[11px] text-[var(--text-muted)]">
            <span className="text-[var(--error)]">*</span> Required field
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="primary" size="sm" isLoading={saving} onClick={submit}>Create Delegation</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default CreateDelegationModal;
