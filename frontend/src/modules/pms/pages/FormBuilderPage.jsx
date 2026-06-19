import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus, Trash2, GripVertical, ChevronUp, ChevronDown, Settings2,
  Type, AlignLeft, Mail, Phone, Hash, Calendar, List, CheckSquare, Minus,
  Info, X, ArrowLeft, ChevronRight, Save, Eye, CheckCircle2,
} from 'lucide-react';
import { Button, Loader } from '../../../shared/components';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../shared/services/pmsService';

// ─── Field type registry ──────────────────────────────────────────────────────
const FIELD_TYPES = [
  { type: 'text',     label: 'Short Text',     icon: Type },
  { type: 'textarea', label: 'Long Text',       icon: AlignLeft },
  { type: 'email',    label: 'Email',           icon: Mail },
  { type: 'phone',    label: 'Phone',           icon: Phone },
  { type: 'number',   label: 'Number',          icon: Hash },
  { type: 'date',     label: 'Date',            icon: Calendar },
  { type: 'dropdown', label: 'Dropdown',        icon: List },
  { type: 'checkbox', label: 'Checkboxes',      icon: CheckSquare },
  { type: 'section',  label: 'Section Header',  icon: Minus },
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

// ─── Left panel — individual field editor ────────────────────────────────────
const FieldEditor = ({ field, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) => {
  const [open, setOpen] = useState(true);
  const FType = FIELD_TYPES.find((t) => t.type === field.type);
  const Icon  = FType?.icon || Type;
  const update = (patch) => onChange({ ...field, ...patch });

  const addOption    = () => update({ options: [...(field.options || []), ''] });
  const updateOption = (i, val) => {
    const opts = [...(field.options || [])]; opts[i] = val; update({ options: opts });
  };
  const removeOption = (i) => update({ options: (field.options || []).filter((_, idx) => idx !== i) });

  return (
    <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)] overflow-hidden">
      {/* Header row */}
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
                        <button type="button" onClick={() => removeOption(i)} className="p-1 text-[var(--text-muted)] hover:text-[var(--error)] transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={addOption} className="text-[10px] font-bold text-[var(--primary)] hover:underline">
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

// ─── Right panel — live form preview ─────────────────────────────────────────
const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 bg-gray-50/80 cursor-not-allowed';

const FieldPreview = ({ field }) => {
  const FType     = FIELD_TYPES.find((t) => t.type === field.type);
  const labelText = field.label || FType?.label || 'Untitled Field';

  if (field.type === 'section') {
    return (
      <div className="pt-2 pb-1 border-b-2 border-gray-100">
        <h3 className="text-sm font-extrabold text-gray-800 tracking-tight">{labelText}</h3>
        {field.description && <p className="text-xs text-gray-400 mt-0.5">{field.description}</p>}
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
        {labelText}
        {field.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {field.type === 'textarea' && (
        <textarea rows={3} placeholder={field.placeholder || ''} disabled className={`${inputCls} resize-none`} />
      )}
      {['text', 'email', 'phone', 'number'].includes(field.type) && (
        <input type={field.type === 'phone' ? 'tel' : field.type} placeholder={field.placeholder || ''} disabled className={inputCls} />
      )}
      {field.type === 'date' && (
        <input type="date" disabled className={inputCls} />
      )}
      {field.type === 'dropdown' && (
        <select disabled className={inputCls}>
          <option value="">Select an option…</option>
          {(field.options || []).filter(Boolean).map((opt, i) => <option key={i}>{opt}</option>)}
        </select>
      )}
      {field.type === 'checkbox' && (
        <div className="space-y-2 pt-0.5">
          {(field.options || []).filter(Boolean).map((opt, i) => (
            <label key={i} className="flex items-center gap-2.5 text-sm text-gray-600 cursor-default">
              <span className="w-4 h-4 rounded border-2 border-gray-300 shrink-0 inline-block" />
              {opt}
            </label>
          ))}
          {(field.options || []).length === 0 && <p className="text-xs text-gray-400 italic">No options yet</p>}
        </div>
      )}
      {field.description && <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">{field.description}</p>}
    </div>
  );
};

// ─── Help drawer (slide-over) ─────────────────────────────────────────────────
const HelpDrawer = ({ onClose }) => (
  <div className="fixed inset-0 z-50 flex">
    <div className="flex-1 bg-black/25 backdrop-blur-[2px]" onClick={onClose} />
    <div className="w-[360px] bg-[var(--surface)] border-l border-[var(--border)] flex flex-col shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-2">
          <Info size={15} className="text-[var(--primary)]" />
          <p className="text-sm font-extrabold text-[var(--text-primary)]">Form Builder Guide</p>
        </div>
        <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg)] transition-colors">
          <X size={15} className="text-[var(--text-muted)]" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
        {/* Workflow steps */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-3">How it works</p>
          <div className="space-y-3">
            {[
              { n: '1', t: 'Create a template',   d: 'Build a reusable form with the fields you need.' },
              { n: '2', t: 'Attach to a project', d: 'Project → Documents → Forms → "Use for this Project".' },
              { n: '3', t: 'Send the link',        d: 'Send via Email or WhatsApp — client gets a public URL.' },
              { n: '4', t: 'Client submits',       d: 'Client opens the link (no login needed) and fills the form.' },
              { n: '5', t: 'PDF auto-saved',       d: 'Response is stored as a PDF under the project\'s Client Details.' },
            ].map(({ n, t, d }) => (
              <div key={n} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-[var(--primary)]/15 text-[var(--primary)] text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">{n}</span>
                <div>
                  <p className="font-bold text-[var(--text-primary)]">{t}</p>
                  <p className="text-[var(--text-muted)] leading-relaxed mt-0.5">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Field types */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-3">Field Types</p>
          <div className="space-y-2">
            {FIELD_TYPES.map(({ type, label, icon: Icon }) => {
              const descs = {
                text:     'Single-line — names, addresses, short answers.',
                textarea: 'Multi-line — requirements, comments, notes.',
                email:    'Validates email format automatically.',
                phone:    'Phone / mobile number.',
                number:   'Numeric only — budgets, quantities, areas.',
                date:     'Date picker — deadlines, visit dates.',
                dropdown: 'Pick one from a list you define.',
                checkbox: 'Pick multiple options from a list.',
                section:  'Visual heading to group related fields.',
              };
              return (
                <div key={type} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
                  <div className="w-7 h-7 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
                    <Icon size={13} className="text-[var(--primary)]" />
                  </div>
                  <div>
                    <p className="font-bold text-[var(--text-primary)]">{label}</p>
                    <p className="text-[var(--text-muted)] leading-relaxed">{descs[type]}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tips */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-3">Best Practices</p>
          <div className="space-y-2.5">
            {[
              'Keep forms under 12 fields — shorter forms get higher completion rates.',
              'Only mark fields as Required when the answer is truly essential.',
              'Use Section Headers to break long forms into labelled groups.',
              'Add a Hint to any question that might confuse clients.',
              'Use Dropdown or Checkboxes for fixed-answer questions to avoid inconsistent data.',
            ].map((tip) => (
              <div key={tip} className="flex items-start gap-2">
                <CheckCircle2 size={12} className="text-[var(--primary)] shrink-0 mt-0.5" />
                <p className="text-[var(--text-secondary)] leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────
const FormBuilderPage = () => {
  const navigate = useNavigate();
  const { id }   = useParams();
  const toast    = useToast();
  const isEdit   = !!id;

  const [pageLoading, setPageLoading] = useState(isEdit);
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [fields,      setFields]      = useState([]);
  const [saving,      setSaving]      = useState(false);
  const [addingType,  setAddingType]  = useState(false);
  const [showHelp,    setShowHelp]    = useState(false);

  // Load existing template in edit mode
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const res = await pmsService.getClientFormTemplate(id);
        const t   = res?.data?.template;
        if (t) { setTitle(t.title || ''); setDescription(t.description || ''); setFields(t.fields || []); }
      } catch {
        toast.error('Failed to load template'); navigate('/pms/form-templates');
      } finally {
        setPageLoading(false);
      }
    })();
  }, [id, isEdit, navigate, toast]);

  // Field mutation helpers
  const updateField = useCallback((fid, updated) => setFields((p) => p.map((f) => (f.id === fid ? updated : f))), []);
  const deleteField = useCallback((fid)           => setFields((p) => p.filter((f) => f.id !== fid)), []);
  const moveField   = useCallback((fid, dir)      => setFields((p) => {
    const idx = p.findIndex((f) => f.id === fid);
    if (idx < 0) return p;
    const next = [...p];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return p;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    return next;
  }), []);
  const addField = (type) => { setFields((p) => [...p, makeField(type)]); setAddingType(false); };

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Template name is required'); return; }
    if (fields.length === 0) { toast.error('Add at least one field'); return; }
    for (const f of fields) {
      if (!f.label.trim()) { toast.error('All fields must have a label'); return; }
      if ((f.type === 'dropdown' || f.type === 'checkbox') && !(f.options || []).length) {
        toast.error(`"${f.label}" needs at least one option`); return;
      }
    }
    setSaving(true);
    try {
      const payload = { title: title.trim(), description: description.trim(), fields };
      if (isEdit) await pmsService.updateClientFormTemplate(id, payload);
      else        await pmsService.createClientFormTemplate(payload);
      toast.success(isEdit ? 'Template updated' : 'Template created');
      navigate('/pms/form-templates');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (pageLoading) return <div className="flex items-center justify-center py-24"><Loader /></div>;

  return (
    <>
      {showHelp && <HelpDrawer onClose={() => setShowHelp(false)} />}

      {/*
        Escape the AppLayout main's p-4 sm:p-6 padding so the builder
        fills edge-to-edge. The negative margins match the parent padding exactly.
      */}
      <div className="-mx-4 sm:-mx-6 -mt-4 sm:-mt-6 -mb-4 sm:-mb-6 flex flex-col" style={{ minHeight: 'calc(100vh - 64px)' }}>

        {/* ── Page header ──────────────────────────────────────────────── */}
        <div className="shrink-0 bg-[var(--surface)] border-b border-[var(--border)] px-5 py-3 flex items-center justify-between gap-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/pms/form-templates')}
              className="p-1.5 rounded-lg hover:bg-[var(--bg)] text-[var(--text-muted)] transition-colors shrink-0"
            >
              <ArrowLeft size={15} />
            </button>
            <ChevronRight size={13} className="text-[var(--text-muted)] shrink-0" />
            <button
              type="button"
              onClick={() => navigate('/pms/form-templates')}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors shrink-0"
            >
              Form Templates
            </button>
            <ChevronRight size={13} className="text-[var(--text-muted)] shrink-0" />
            <span className="text-sm font-extrabold text-[var(--text-primary)] truncate">
              {isEdit ? (title || 'Edit Template') : 'New Template'}
            </span>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--primary)] hover:border-[var(--primary)]/40 transition-colors"
            >
              <Info size={13} />
              Guide
            </button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/pms/form-templates')}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
              <Save size={13} />
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Template'}
            </Button>
          </div>
        </div>

        {/* ── Two-panel body ────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 117px)' }}>

          {/* ── Left: Builder ──────────────────────────────────────────── */}
          <div className="w-[420px] xl:w-[460px] shrink-0 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col overflow-y-auto">
            <div className="p-5 flex flex-col gap-5 flex-1">

              {/* Template meta */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
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
                  <label className="block text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                    Description <span className="text-[var(--text-muted)] font-medium normal-case tracking-normal">(shown to client)</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief intro shown at the top of the form…"
                    rows={2}
                    className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]/50 resize-none"
                  />
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-[var(--border)]" />

              {/* Fields section */}
              <div className="flex flex-col gap-3 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                    Fields{fields.length > 0 ? ` (${fields.length})` : ''}
                  </p>
                </div>

                {/* Field list */}
                {fields.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-[var(--border)] rounded-xl text-center">
                    <Plus size={20} className="text-[var(--text-muted)] mb-2" />
                    <p className="text-xs font-bold text-[var(--text-muted)]">No fields yet</p>
                    <p className="text-[10px] text-[var(--text-muted)]/70 mt-0.5">Click "Add Field" below to get started</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {fields.map((f, idx) => (
                      <FieldEditor
                        key={f.id}
                        field={f}
                        onChange={(u)    => updateField(f.id, u)}
                        onDelete={()     => deleteField(f.id)}
                        onMoveUp={()     => moveField(f.id, -1)}
                        onMoveDown={()   => moveField(f.id, +1)}
                        isFirst={idx === 0}
                        isLast={idx === fields.length - 1}
                      />
                    ))}
                  </div>
                )}

                {/* Add field control */}
                {addingType ? (
                  <div className="border border-[var(--border)] rounded-xl p-3 bg-[var(--bg)]">
                    <p className="text-[10px] font-bold text-[var(--text-muted)] mb-2">Choose field type</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {FIELD_TYPES.map(({ type, label, icon: Icon }) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => addField(type)}
                          className="flex items-center gap-1.5 px-2 py-2 text-xs font-bold rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--primary)]/40 hover:text-[var(--primary)] transition-colors text-left"
                        >
                          <Icon size={12} className="shrink-0" />
                          {label}
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={() => setAddingType(false)} className="mt-2 text-[10px] text-[var(--text-muted)] hover:underline">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingType(true)}
                    className="flex items-center justify-center gap-2 w-full py-2.5 text-xs font-bold rounded-xl border-2 border-dashed border-[var(--primary)]/30 text-[var(--primary)] hover:bg-[var(--primary)]/5 hover:border-[var(--primary)]/50 transition-colors"
                  >
                    <Plus size={13} />
                    Add Field
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Right: Live preview ──────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto bg-[var(--bg)] p-6">
            {/* Preview label */}
            <div className="flex items-center gap-2 mb-4">
              <Eye size={13} className="text-[var(--text-muted)]" />
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Client Preview</span>
              <span className="text-[10px] text-[var(--text-muted)]/60">— updates as you type</span>
            </div>

            {/* Form card — mirrors PublicFormPage styling */}
            <div className="max-w-[540px] mx-auto bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
              {/* Header band */}
              <div className="px-7 py-6" style={{ background: 'var(--primary)' }}>
                <h2 className="text-lg font-extrabold text-black leading-snug">
                  {title.trim() || <span className="opacity-30 font-normal italic">Form title appears here</span>}
                </h2>
                {description.trim() && (
                  <p className="text-sm text-black/70 mt-1.5 leading-relaxed">{description}</p>
                )}
              </div>

              {/* Fields */}
              <div className="px-7 py-6 space-y-5">
                {fields.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center mx-auto mb-3">
                      <Eye size={18} className="text-gray-300" />
                    </div>
                    <p className="text-sm text-gray-400">Add fields on the left to see the preview here</p>
                  </div>
                ) : (
                  fields.map((f) => <FieldPreview key={f.id} field={f} />)
                )}
              </div>

              {/* Submit button preview */}
              {fields.length > 0 && (
                <div className="px-7 py-5 bg-gray-50 border-t border-gray-100">
                  <button type="button" disabled className="w-full py-3 rounded-xl text-sm font-bold text-black cursor-not-allowed" style={{ background: 'var(--primary)', opacity: 0.8 }}>
                    Submit Form
                  </button>
                  <p className="text-center text-[10px] text-gray-400 mt-2">Preview only — not interactive</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default FormBuilderPage;
