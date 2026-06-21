import React from 'react';
import logo from '../../../assets/JJ-FINAL-LOGO-PNG.png';

// Shared chrome + read-only field rendering for the client form, so the builder
// live preview, the Preview modal, and the public PublicFormPage all stay in
// sync (same logo, same ERP theme). Interactive inputs live in PublicFormPage;
// everything visual/branding is centralised here.

const FIELD_TYPE_LABEL = {
  text:     'Short Text',
  textarea: 'Long Text',
  email:    'Email',
  phone:    'Phone',
  number:   'Number',
  date:     'Date',
  dropdown: 'Dropdown',
  checkbox: 'Checkboxes',
  section:  'Section Header',
};

// ─── Branded header band (gold, with the JJ-Studio logo) ───────────────────────
// Used at the top of every rendering of a client form.
export const FormBrandHeader = ({ title, description, projectName }) => (
  <div className="px-6 py-5" style={{ background: 'var(--primary)' }}>
    <div className="flex items-center gap-3">
      {/* Logo chip — white so the logo stays legible on the gold band */}
      <div className="w-11 h-11 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0 p-1.5">
        <img src={logo} alt="JJ Studio" className="w-full h-full object-contain" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-black/55">JJ Studio</p>
        <h2 className="text-lg font-extrabold text-black leading-snug">
          {title?.trim() ? title : <span className="opacity-40 font-normal italic">Form title appears here</span>}
        </h2>
      </div>
    </div>
    {description?.trim() && (
      <p className="text-sm text-black/70 mt-2.5 leading-relaxed">{description}</p>
    )}
    {projectName && (
      <p className="text-xs text-black/60 mt-1.5">Project: <strong className="text-black/80">{projectName}</strong></p>
    )}
  </div>
);

// ─── Read-only themed field (preview only — disabled inputs) ───────────────────
const previewInputCls =
  'w-full px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-muted)] bg-[var(--bg)] cursor-not-allowed';

export const ThemedFieldPreview = ({ field }) => {
  const labelText = field.label || FIELD_TYPE_LABEL[field.type] || 'Untitled Field';

  if (field.type === 'section') {
    return (
      <div className="pt-1 pb-1 border-b-2 border-[var(--border)]">
        <h3 className="text-sm font-extrabold text-[var(--text-primary)] tracking-tight">{labelText}</h3>
        {field.description && <p className="text-xs text-[var(--text-muted)] mt-0.5">{field.description}</p>}
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5">
        {labelText}
        {field.required && <span className="text-[var(--error)] ml-0.5">*</span>}
      </label>
      {field.type === 'textarea' && (
        <textarea rows={3} placeholder={field.placeholder || ''} disabled className={`${previewInputCls} resize-none`} />
      )}
      {['text', 'email', 'phone', 'number'].includes(field.type) && (
        <input type={field.type === 'phone' ? 'tel' : field.type} placeholder={field.placeholder || ''} disabled className={previewInputCls} />
      )}
      {field.type === 'date' && <input type="date" disabled className={previewInputCls} />}
      {field.type === 'dropdown' && (
        <select disabled className={previewInputCls}>
          <option value="">Select an option…</option>
          {(field.options || []).filter(Boolean).map((opt, i) => <option key={i}>{opt}</option>)}
        </select>
      )}
      {field.type === 'checkbox' && (
        <div className="space-y-2 pt-0.5">
          {(field.options || []).filter(Boolean).map((opt, i) => (
            <label key={i} className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)] cursor-default">
              <span className="w-4 h-4 rounded border-2 border-[var(--border)] shrink-0 inline-block" />
              {opt}
            </label>
          ))}
          {(field.options || []).length === 0 && <p className="text-xs text-[var(--text-muted)] italic">No options yet</p>}
        </div>
      )}
      {field.description && <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-relaxed">{field.description}</p>}
    </div>
  );
};

// ─── Full read-only preview card (header + fields + disabled submit) ───────────
// Used by the builder live preview and the Preview modal.
export const ClientFormPreviewCard = ({ template, emptyHint }) => {
  const fields = template?.fields || [];
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
      <FormBrandHeader title={template?.title} description={template?.description} />

      <div className="px-6 py-6 space-y-5">
        {fields.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--text-muted)]">
            {emptyHint || 'This form has no fields yet.'}
          </p>
        ) : (
          fields.map((f) => <ThemedFieldPreview key={f.id} field={f} />)
        )}
      </div>

      {fields.length > 0 && (
        <div className="px-6 py-5 bg-[var(--bg)]/60 border-t border-[var(--border)]">
          <button
            type="button"
            disabled
            className="w-full py-3 rounded-xl text-sm font-bold text-black cursor-not-allowed bg-[var(--primary)] opacity-80"
          >
            Submit Form
          </button>
          <p className="text-center text-[10px] text-[var(--text-muted)] mt-2">Preview only — not interactive</p>
        </div>
      )}
    </div>
  );
};
