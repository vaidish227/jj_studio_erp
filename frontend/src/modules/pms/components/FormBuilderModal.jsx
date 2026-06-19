import React, { useState, useCallback } from 'react';
import {
  Plus, Trash2, GripVertical, ChevronUp, ChevronDown, Settings2,
  Type, AlignLeft, Mail, Phone, Hash, Calendar, List, CheckSquare, Minus,
  Info, X, CheckCircle2, Send,
} from 'lucide-react';
import { Button, Modal } from '../../../shared/components';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../shared/services/pmsService';

const FIELD_TYPES = [
  { type: 'text',     label: 'Short Text',   icon: Type },
  { type: 'textarea', label: 'Long Text',    icon: AlignLeft },
  { type: 'email',    label: 'Email',        icon: Mail },
  { type: 'phone',    label: 'Phone',        icon: Phone },
  { type: 'number',   label: 'Number',       icon: Hash },
  { type: 'date',     label: 'Date',         icon: Calendar },
  { type: 'dropdown', label: 'Dropdown',     icon: List },
  { type: 'checkbox', label: 'Checkboxes',   icon: CheckSquare },
  { type: 'section',  label: 'Section Header', icon: Minus },
];

const makeField = (type = 'text') => ({
  id:          crypto.randomUUID(),
  type,
  label:       '',
  placeholder: '',
  description: '',
  required:    false,
  options:     type === 'dropdown' || type === 'checkbox' ? ['Option 1'] : [],
});

// ─── Individual field editor ──────────────────────────────────────────────────
const FieldEditor = ({ field, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) => {
  const [open, setOpen] = useState(true);
  const FType = FIELD_TYPES.find((t) => t.type === field.type);
  const Icon  = FType?.icon || Type;

  const update = (patch) => onChange({ ...field, ...patch });

  const addOption = () => update({ options: [...(field.options || []), ''] });
  const updateOption = (i, val) => {
    const opts = [...(field.options || [])];
    opts[i] = val;
    update({ options: opts });
  };
  const removeOption = (i) => {
    const opts = (field.options || []).filter((_, idx) => idx !== i);
    update({ options: opts });
  };

  return (
    <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)] overflow-hidden">
      {/* Field header row */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-[var(--bg)]">
        <GripVertical size={14} className="text-[var(--text-muted)] shrink-0" />
        <div className="w-6 h-6 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
          <Icon size={12} className="text-[var(--primary)]" />
        </div>
        <span className="text-xs font-bold text-[var(--text-primary)] truncate flex-1">
          {field.label || FType?.label || 'Field'}
        </span>
        {field.type !== 'section' && (
          <label className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => update({ required: e.target.checked })}
              className="w-3 h-3 accent-[var(--primary)]"
            />
            Required
          </label>
        )}
        <div className="flex items-center gap-0.5 shrink-0">
          <button type="button" onClick={onMoveUp}   disabled={isFirst} className="p-1 rounded hover:bg-[var(--border)] disabled:opacity-30 transition-colors"><ChevronUp   size={12} /></button>
          <button type="button" onClick={onMoveDown} disabled={isLast}  className="p-1 rounded hover:bg-[var(--border)] disabled:opacity-30 transition-colors"><ChevronDown size={12} /></button>
          <button type="button" onClick={() => setOpen((v) => !v)} className="p-1 rounded hover:bg-[var(--border)] transition-colors"><Settings2 size={12} /></button>
          <button type="button" onClick={onDelete} className="p-1 rounded hover:bg-[var(--error)]/10 hover:text-[var(--error)] transition-colors"><Trash2 size={12} /></button>
        </div>
      </div>

      {open && (
        <div className="p-3 space-y-2 text-xs">
          {/* Label */}
          <div>
            <label className="block text-[10px] font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">
              {field.type === 'section' ? 'Section Title' : 'Label'}
            </label>
            <input
              type="text"
              value={field.label}
              onChange={(e) => update({ label: e.target.value })}
              placeholder={FType?.label}
              className="w-full px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]/50"
            />
          </div>

          {field.type !== 'section' && (
            <>
              {/* Placeholder */}
              {['text', 'textarea', 'email', 'phone', 'number'].includes(field.type) && (
                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">Placeholder</label>
                  <input
                    type="text"
                    value={field.placeholder}
                    onChange={(e) => update({ placeholder: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]/50"
                  />
                </div>
              )}

              {/* Hint */}
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">Hint (optional)</label>
                <input
                  type="text"
                  value={field.description}
                  onChange={(e) => update({ description: e.target.value })}
                  placeholder="Helper text shown below the field"
                  className="w-full px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]/50"
                />
              </div>

              {/* Options (dropdown / checkbox) */}
              {(field.type === 'dropdown' || field.type === 'checkbox') && (
                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">Options</label>
                  <div className="space-y-1">
                    {(field.options || []).map((opt, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => updateOption(i, e.target.value)}
                          placeholder={`Option ${i + 1}`}
                          className="flex-1 px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]/50"
                        />
                        <button
                          type="button"
                          onClick={() => removeOption(i)}
                          className="p-1 text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addOption}
                      className="text-[10px] font-bold text-[var(--primary)] hover:underline"
                    >
                      + Add option
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Help panel ───────────────────────────────────────────────────────────────
const HELP_FIELD_TYPES = [
  { icon: Type,        label: 'Short Text',     desc: 'Single-line input — ideal for names, cities, short answers.' },
  { icon: AlignLeft,   label: 'Long Text',      desc: 'Multi-line textarea — use for requirements, feedback, or notes.' },
  { icon: Mail,        label: 'Email',          desc: 'Validated email address field.' },
  { icon: Phone,       label: 'Phone',          desc: 'Phone number input.' },
  { icon: Hash,        label: 'Number',         desc: 'Numeric-only input — for budgets, quantities, measurements.' },
  { icon: Calendar,    label: 'Date',           desc: 'Date picker — for deadlines, visit dates, handover dates.' },
  { icon: List,        label: 'Dropdown',       desc: 'Single-select from a predefined list of options.' },
  { icon: CheckSquare, label: 'Checkboxes',     desc: 'Multi-select — client can pick multiple options.' },
  { icon: Minus,       label: 'Section Header', desc: 'Visual divider with a title to group related questions.' },
];

const HELP_TIPS = [
  { icon: CheckCircle2, text: 'Mark only truly essential fields as Required — long required forms get abandoned.' },
  { icon: Minus,        text: 'Use Section Headers to break a long form into logical parts (e.g. "Space Details", "Budget").' },
  { icon: AlignLeft,    text: 'Add a Hint to any field that may confuse clients — it shows up as helper text below the input.' },
  { icon: List,         text: 'Use Dropdown or Checkboxes when the answer set is fixed — it prevents typos and speeds up filtering.' },
];

const HelpPanel = ({ onClose }) => (
  <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-4 space-y-4 text-xs">
    {/* Header */}
    <div className="flex items-center justify-between">
      <p className="text-[10px] font-black uppercase tracking-wider text-[var(--primary)]">Form Builder Guide</p>
      <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[var(--border)] transition-colors">
        <X size={12} className="text-[var(--text-muted)]" />
      </button>
    </div>

    {/* Workflow */}
    <div>
      <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-2">Workflow</p>
      <div className="flex items-center gap-1.5 flex-wrap">
        {['Create template', 'Attach to project', 'Send link to client', 'Client fills form', 'PDF auto-saved'].map((step, i, arr) => (
          <React.Fragment key={step}>
            <span className="px-2 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-[10px] font-bold whitespace-nowrap">{step}</span>
            {i < arr.length - 1 && <Send size={9} className="text-[var(--text-muted)] shrink-0" />}
          </React.Fragment>
        ))}
      </div>
    </div>

    {/* Field types */}
    <div>
      <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-2">Field Types</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {HELP_FIELD_TYPES.map(({ icon: Icon, label, desc }) => (
          <div key={label} className="flex items-start gap-2 p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
            <div className="w-5 h-5 rounded bg-[var(--primary)]/10 flex items-center justify-center shrink-0 mt-0.5">
              <Icon size={10} className="text-[var(--primary)]" />
            </div>
            <div>
              <p className="font-bold text-[var(--text-primary)] leading-none mb-0.5">{label}</p>
              <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Tips */}
    <div>
      <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-2">Tips for Better Forms</p>
      <div className="space-y-1.5">
        {HELP_TIPS.map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-start gap-2">
            <Icon size={11} className="text-[var(--primary)] shrink-0 mt-0.5" />
            <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ─── Main modal ───────────────────────────────────────────────────────────────
/**
 * FormBuilderModal — create or edit a ClientFormTemplate.
 *
 * Props:
 *   isOpen     — boolean
 *   onClose()  — close handler
 *   template   — existing template object to edit (null → create mode)
 *   onSaved(t) — called with the saved template after create/update
 */
const FormBuilderModal = ({ isOpen, onClose, template, onSaved }) => {
  const toast = useToast();
  const isEdit = !!template;

  const [title,       setTitle]       = useState(template?.title       || '');
  const [description, setDescription] = useState(template?.description || '');
  const [fields,      setFields]      = useState(template?.fields      || []);
  const [saving,      setSaving]      = useState(false);
  const [addingType,  setAddingType]  = useState(false);
  const [showHelp,    setShowHelp]    = useState(false);

  const updateField = useCallback((id, updated) => {
    setFields((prev) => prev.map((f) => (f.id === id ? updated : f)));
  }, []);

  const deleteField = useCallback((id) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const moveField = useCallback((id, dir) => {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }, []);

  const addField = (type) => {
    setFields((prev) => [...prev, makeField(type)]);
    setAddingType(false);
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Template title is required'); return; }
    if (fields.length === 0) { toast.error('Add at least one field'); return; }
    // Validate labels
    for (const f of fields) {
      if (!f.label.trim()) { toast.error('All fields must have a label'); return; }
      if ((f.type === 'dropdown' || f.type === 'checkbox') && (f.options || []).length === 0) {
        toast.error(`"${f.label}" needs at least one option`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = { title: title.trim(), description: description.trim(), fields };
      const res = isEdit
        ? await pmsService.updateClientFormTemplate(template._id, payload)
        : await pmsService.createClientFormTemplate(payload);
      const saved = res?.data?.template;
      toast.success(isEdit ? 'Template updated' : 'Template created');
      onSaved?.(saved);
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Form Template' : 'New Form Template'}
      className="max-w-2xl"
    >
      <div className="flex flex-col gap-4">
        {/* Help toggle button */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors
              ${showHelp
                ? 'bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/30'
                : 'bg-[var(--bg)] text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--primary)] hover:border-[var(--primary)]/30'}`}
            title="How to use the form builder"
          >
            <Info size={11} />
            How to use
          </button>
        </div>

        {/* Inline help panel */}
        {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}

        {/* Template meta */}
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Template Name <span className="text-[var(--error)]">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Initial Client Requirements"
              className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]/50"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description shown to the client at the top of the form"
              rows={2}
              className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]/50 resize-none"
            />
          </div>
        </div>

        {/* Fields list */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Fields ({fields.length})
          </p>
          <div className="space-y-2 max-h-[40vh] overflow-y-auto custom-scrollbar pr-1">
            {fields.length === 0 ? (
              <div className="text-center py-8 text-xs text-[var(--text-muted)]">
                No fields yet. Click "Add Field" to get started.
              </div>
            ) : (
              fields.map((f, idx) => (
                <FieldEditor
                  key={f.id}
                  field={f}
                  onChange={(updated) => updateField(f.id, updated)}
                  onDelete={() => deleteField(f.id)}
                  onMoveUp={() => moveField(f.id, -1)}
                  onMoveDown={() => moveField(f.id, +1)}
                  isFirst={idx === 0}
                  isLast={idx === fields.length - 1}
                />
              ))
            )}
          </div>
        </div>

        {/* Add field picker */}
        {addingType ? (
          <div className="border border-[var(--border)] rounded-xl p-3 bg-[var(--bg)]">
            <p className="text-[10px] font-bold text-[var(--text-muted)] mb-2">Choose field type</p>
            <div className="grid grid-cols-3 gap-1.5">
              {FIELD_TYPES.map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => addField(type)}
                  className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-bold rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--primary)]/40 hover:text-[var(--primary)] transition-colors text-left"
                >
                  <Icon size={12} className="shrink-0" />
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAddingType(false)}
              className="mt-2 text-[10px] text-[var(--text-muted)] hover:underline"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingType(true)}
            className="flex items-center justify-center gap-2 w-full py-2 text-xs font-bold rounded-xl border border-dashed border-[var(--primary)]/40 text-[var(--primary)] hover:bg-[var(--primary)]/5 transition-colors"
          >
            <Plus size={13} />
            Add Field
          </button>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Template'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default FormBuilderModal;
