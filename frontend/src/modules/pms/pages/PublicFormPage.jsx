import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  CheckCircle, AlertCircle, Loader2,
} from 'lucide-react';
import apiClient from '../../../shared/services/apiClient';
import { FormBrandHeader } from '../components/clientFormShared';

// ─── Individual field renderer ────────────────────────────────────────────────
const FieldInput = ({ field, value, onChange, error }) => {
  const baseClass =
    'w-full px-3 py-2.5 rounded-xl border text-sm text-[var(--text-primary)] focus:outline-none transition-colors ' +
    (error
      ? 'border-[var(--error)] focus:border-[var(--error)] bg-[var(--error)]/5'
      : 'border-[var(--border)] focus:border-[var(--primary)]/50 bg-[var(--bg)]');

  if (field.type === 'section') {
    return (
      <div className="pt-2 pb-1">
        <h3 className="text-sm font-black text-[var(--text-primary)] border-b border-[var(--border)] pb-2">
          {field.label}
        </h3>
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={4}
        className={`${baseClass} resize-none`}
      />
    );
  }

  if (field.type === 'dropdown') {
    return (
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={baseClass}
      >
        <option value="">Select…</option>
        {(field.options || []).map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  if (field.type === 'checkbox') {
    const selected = Array.isArray(value) ? value : [];
    const toggle = (opt) => {
      const next = selected.includes(opt)
        ? selected.filter((v) => v !== opt)
        : [...selected, opt];
      onChange(next);
    };
    return (
      <div className="space-y-1.5">
        {(field.options || []).map((opt) => (
          <label key={opt} className="flex items-center gap-2.5 cursor-pointer group">
            <div
              onClick={() => toggle(opt)}
              className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                selected.includes(opt)
                  ? 'bg-[var(--primary)] border-[var(--primary)]'
                  : 'border-[var(--border)] group-hover:border-[var(--primary)]/50'
              }`}
            >
              {selected.includes(opt) && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3L3.5 5.5L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
            </div>
            <span className="text-sm text-[var(--text-primary)]">{opt}</span>
          </label>
        ))}
      </div>
    );
  }

  const inputType = { email: 'email', phone: 'tel', number: 'number', date: 'date' }[field.type] || 'text';
  return (
    <input
      type={inputType}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      className={baseClass}
    />
  );
};

// ─── Public form page ─────────────────────────────────────────────────────────
const PublicFormPage = () => {
  const { token } = useParams();
  const [form,      setForm]      = useState(null);
  const [loadState, setLoadState] = useState('loading'); // loading | ready | gone | error
  const [goneMsg,   setGoneMsg]   = useState('');
  const [formData,  setFormData]  = useState({});
  const [errors,    setErrors]    = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient.get(`/client-forms/public/${token}`)
      .then((res) => {
        if (!cancelled) {
          setForm(res.form);
          setLoadState('ready');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err?.response?.data?.message || '';
          if (err?.response?.status === 404 || err?.response?.status === 410) {
            setGoneMsg(msg || 'This form is no longer available.');
            setLoadState('gone');
          } else {
            setLoadState('error');
          }
        }
      });
    return () => { cancelled = true; };
  }, [token]);

  const setField = (fieldId, val) => {
    setFormData((prev) => ({ ...prev, [fieldId]: val }));
    setErrors((prev) => { const n = { ...prev }; delete n[fieldId]; return n; });
  };

  const validate = () => {
    const errs = {};
    for (const f of form?.fields || []) {
      if (f.required && f.type !== 'section') {
        const val = formData[f.id];
        const empty =
          val === undefined || val === null || val === '' ||
          (Array.isArray(val) && val.length === 0);
        if (empty) errs[f.id] = `"${f.label}" is required`;
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await apiClient.post(`/client-forms/public/${token}/submit`, { data: formData });
      setSubmitted(true);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Submission failed. Please try again.';
      // If it's a "already submitted" scenario
      if (err?.response?.status === 410 || err?.response?.status === 400) {
        setGoneMsg(msg);
        setLoadState('gone');
      } else {
        setErrors({ _global: msg });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ──
  if (loadState === 'loading') {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  // ── Gone / expired ──
  if (loadState === 'gone') {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center mx-auto">
            <AlertCircle size={26} className="text-[var(--primary)]" />
          </div>
          <h1 className="text-lg font-extrabold text-[var(--text-primary)]">Form Unavailable</h1>
          <p className="text-sm text-[var(--text-secondary)]">{goneMsg}</p>
          <p className="text-xs text-[var(--text-muted)]">Please contact JJ Studio if you believe this is an error.</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (loadState === 'error') {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center space-y-3">
          <AlertCircle size={32} className="text-[var(--error)] mx-auto" />
          <h1 className="text-lg font-extrabold text-[var(--text-primary)]">Something went wrong</h1>
          <p className="text-sm text-[var(--text-secondary)]">Could not load the form. Please try again later.</p>
        </div>
      </div>
    );
  }

  // ── Submitted ──
  if (submitted) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[var(--success)]/10 flex items-center justify-center mx-auto">
            <CheckCircle size={32} className="text-[var(--success)]" />
          </div>
          <h1 className="text-xl font-extrabold text-[var(--text-primary)]">Thank you!</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Your response has been submitted successfully.{' '}
            {form?.projectName && `Our team for "${form.projectName}" will review it shortly.`}
          </p>
          <p className="text-xs text-[var(--text-muted)]">You may close this window.</p>
        </div>
      </div>
    );
  }

  // ── Ready ──
  const fields = form?.fields || [];

  return (
    <div className="min-h-screen bg-[var(--bg)] py-8 px-4">
      <div className="max-w-xl mx-auto space-y-6">

        {/* Form card */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
          {/* Branded, themed header (logo + title) */}
          <FormBrandHeader title={form?.title} description={form?.description} projectName={form?.projectName} />

          {/* Fields */}
          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
            {errors._global && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--error)]/10 text-[var(--error)] text-xs font-bold">
                <AlertCircle size={14} />
                {errors._global}
              </div>
            )}

            {fields.map((f) => (
              <div key={f.id}>
                {f.type !== 'section' && (
                  <label className="block text-sm font-bold text-[var(--text-primary)] mb-1.5">
                    {f.label}
                    {f.required && <span className="text-[var(--error)] ml-0.5">*</span>}
                  </label>
                )}
                {f.description && f.type !== 'section' && (
                  <p className="text-[11px] text-[var(--text-muted)] mb-1.5">{f.description}</p>
                )}
                <FieldInput
                  field={f}
                  value={formData[f.id]}
                  onChange={(val) => setField(f.id, val)}
                  error={errors[f.id]}
                />
                {errors[f.id] && (
                  <p className="text-[11px] text-[var(--error)] mt-1">{errors[f.id]}</p>
                )}
              </div>
            ))}

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-[var(--primary)] text-black text-sm font-black hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Submit Form'}
              </button>
              <p className="text-[10px] text-center text-[var(--text-muted)] mt-2">
                Your response is securely stored and shared only with the JJ Studio team.
              </p>
            </div>
          </form>
        </div>

        <p className="text-center text-[10px] text-[var(--text-muted)]">
          © JJ Studio ERP System
        </p>
      </div>
    </div>
  );
};

export default PublicFormPage;
