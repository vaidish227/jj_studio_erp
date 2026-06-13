import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Eye, Variable } from 'lucide-react';
import Button from '../../../shared/components/Button/Button';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { kitService } from '../../../shared/services/kitService';
import { CHANNELS, CATEGORIES, MEDIA_TYPES } from '../constants';

const channelRoute = { whatsapp: '/kit/whatsapp', email: '/kit/mail', notification: '/kit/mail' };

const emptyForm = {
  channel: 'whatsapp', name: '', category: 'custom',
  subject: '', htmlBody: '', textBody: '', body: '', title: '', deepLink: '',
  mediaType: 'none', mediaUrl: '', isActive: true,
};

/** Build the create/update payload with only the fields relevant to the channel. */
const buildPayload = (f) => {
  const base = { channel: f.channel, name: f.name.trim(), category: f.category, isActive: f.isActive };
  if (f.channel === 'email') return { ...base, subject: f.subject, htmlBody: f.htmlBody, textBody: f.textBody || undefined };
  if (f.channel === 'whatsapp') return { ...base, body: f.body, mediaType: f.mediaType, mediaUrl: f.mediaUrl || undefined };
  return { ...base, title: f.title, body: f.body, deepLink: f.deepLink || undefined }; // notification
};

const TemplateEditorPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = !!id;

  const [form, setForm] = useState({ ...emptyForm, channel: searchParams.get('channel') || 'whatsapp' });
  const [variables, setVariables] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);

  const activeFieldRef = useRef(null); // last-focused input/textarea, for variable insertion
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  // ── load catalog + (on edit) the template ──────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const v = await kitService.getVariables();
        setVariables(v?.data?.variables || []);
      } catch { /* non-fatal */ }
      if (isEdit) {
        try {
          const res = await kitService.getTemplate(id);
          setForm({ ...emptyForm, ...res.data });
        } catch (err) {
          toast.error(err?.message || 'Failed to load template');
          navigate('/kit/whatsapp');
        } finally {
          setLoading(false);
        }
      }
    })();
  }, [id, isEdit, navigate, toast]);

  // ── live preview (debounced) ────────────────────────────────────────────────
  const runPreview = useCallback(async (f) => {
    try {
      const res = await kitService.preview({
        channel: f.channel,
        subject: f.subject, htmlBody: f.htmlBody, textBody: f.textBody,
        body: f.body, title: f.title,
      });
      setPreview(res.data);
    } catch (err) {
      setPreview({ error: err?.message || 'Preview failed' });
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => runPreview(form), 500);
    return () => clearTimeout(t);
  }, [form, runPreview]);

  // ── insert {{token}} at cursor of the last-focused field ────────────────────
  const insertVariable = (key) => {
    const token = `{{${key}}}`;
    const el = activeFieldRef.current;
    if (el && el.name && typeof el.selectionStart === 'number') {
      const fieldName = el.name;
      const cur = form[fieldName] || '';
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = cur.slice(0, start) + token + cur.slice(end);
      set({ [fieldName]: next });
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      });
    } else {
      // Fallback: append to the channel's primary content field.
      const primary = form.channel === 'email' ? 'htmlBody' : 'body';
      set({ [primary]: (form[primary] || '') + token });
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Template name is required');
    setSaving(true);
    try {
      const payload = buildPayload(form);
      if (isEdit) {
        await kitService.updateTemplate(id, payload);
        toast.success('Template updated');
      } else {
        await kitService.createTemplate(payload);
        toast.success('Template created');
      }
      navigate(channelRoute[form.channel] || '/kit/whatsapp');
    } catch (err) {
      toast.error(err?.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const fieldClass =
    'w-full px-4 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] transition-colors';
  const labelClass = 'block text-xs font-black uppercase tracking-wider text-[var(--text-muted)] mb-1.5';
  const trackFocus = (e) => { activeFieldRef.current = e.target; };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-[var(--text-muted)]">
        <Loader2 size={40} className="animate-spin mb-4 opacity-20" />
        <p className="text-sm font-bold uppercase tracking-widest">Loading template...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
            {isEdit ? 'Edit Template' : 'New Template'}
          </h1>
        </div>
        <Button variant="primary" onClick={handleSave} disabled={saving} className="px-6 py-2.5">
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {isEdit ? 'Save Changes' : 'Create Template'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor column */}
        <div className="lg:col-span-2 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Channel</label>
              <select className={fieldClass} value={form.channel} disabled={isEdit}
                onChange={(e) => set({ channel: e.target.value })}>
                {Object.values(CHANNELS).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Category</label>
              <select className={fieldClass} value={form.category} onChange={(e) => set({ category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Template Name</label>
            <input name="name" className={fieldClass} value={form.name} onFocus={trackFocus}
              onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Lead Follow-up Day 2" />
          </div>

          {/* Channel-specific fields */}
          {form.channel === 'email' && (
            <>
              <div>
                <label className={labelClass}>Subject</label>
                <input name="subject" className={fieldClass} value={form.subject} onFocus={trackFocus}
                  onChange={(e) => set({ subject: e.target.value })} placeholder="Hi {{client_name}}, an update on your project" />
              </div>
              <div>
                <label className={labelClass}>HTML Body</label>
                <textarea name="htmlBody" rows={10} className={`${fieldClass} font-mono`} value={form.htmlBody} onFocus={trackFocus}
                  onChange={(e) => set({ htmlBody: e.target.value })} placeholder="<p>Dear {{client_name}}, ...</p>" />
              </div>
              <div>
                <label className={labelClass}>Plain-text Fallback (optional)</label>
                <textarea name="textBody" rows={3} className={fieldClass} value={form.textBody} onFocus={trackFocus}
                  onChange={(e) => set({ textBody: e.target.value })} />
              </div>
            </>
          )}

          {form.channel === 'whatsapp' && (
            <>
              <div>
                <label className={labelClass}>Message Body</label>
                <textarea name="body" rows={8} className={fieldClass} value={form.body} onFocus={trackFocus}
                  onChange={(e) => set({ body: e.target.value })} placeholder="Hi {{client_name}}, just checking in about {{project_type}}..." />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Media Type</label>
                  <select className={fieldClass} value={form.mediaType} onChange={(e) => set({ mediaType: e.target.value })}>
                    {MEDIA_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                {form.mediaType !== 'none' && (
                  <div>
                    <label className={labelClass}>Media URL</label>
                    <input name="mediaUrl" className={fieldClass} value={form.mediaUrl} onFocus={trackFocus}
                      onChange={(e) => set({ mediaUrl: e.target.value })} placeholder="https://..." />
                  </div>
                )}
              </div>
            </>
          )}

          {form.channel === 'notification' && (
            <>
              <div>
                <label className={labelClass}>Title</label>
                <input name="title" className={fieldClass} value={form.title} onFocus={trackFocus}
                  onChange={(e) => set({ title: e.target.value })} placeholder="New update on {{project_name}}" />
              </div>
              <div>
                <label className={labelClass}>Message</label>
                <textarea name="body" rows={6} className={fieldClass} value={form.body} onFocus={trackFocus}
                  onChange={(e) => set({ body: e.target.value })} placeholder="Hi {{client_name}}, ..." />
              </div>
              <div>
                <label className={labelClass}>Deep Link (optional)</label>
                <input name="deepLink" className={fieldClass} value={form.deepLink} onFocus={trackFocus}
                  onChange={(e) => set({ deepLink: e.target.value })} placeholder="/crm/leads/123" />
              </div>
            </>
          )}

          <label className="flex items-center gap-2.5 cursor-pointer w-fit">
            <input type="checkbox" checked={form.isActive} onChange={(e) => set({ isActive: e.target.checked })}
              className="w-4 h-4 accent-[var(--primary)]" />
            <span className="text-sm font-bold text-[var(--text-secondary)]">Active</span>
          </label>
        </div>

        {/* Side column: variables + live preview */}
        <div className="space-y-6">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3 text-[var(--text-primary)]">
              <Variable size={16} />
              <h3 className="font-black text-sm uppercase tracking-wider">Variables</h3>
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-3">Click to insert at cursor.</p>
            <div className="flex flex-wrap gap-2">
              {variables.map((v) => (
                <button key={v.key} onClick={() => insertVariable(v.key)} title={v.label}
                  className="px-2.5 py-1 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-xs font-mono font-bold text-[var(--primary)] hover:border-[var(--primary)] transition-colors">
                  {`{{${v.key}}}`}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3 text-[var(--text-primary)]">
              <Eye size={16} />
              <h3 className="font-black text-sm uppercase tracking-wider">Live Preview</h3>
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-3">Rendered with sample data.</p>
            {preview?.error ? (
              <p className="text-xs text-[var(--error)]">{preview.error}</p>
            ) : (
              <div className="space-y-2 text-sm">
                {form.channel === 'email' && (
                  <p><span className="font-bold text-[var(--text-muted)]">Subject: </span>{preview?.rendered?.subject}</p>
                )}
                {form.channel === 'notification' && (
                  <p className="font-bold text-[var(--text-primary)]">{preview?.rendered?.title}</p>
                )}
                <div className="bg-[var(--bg)] rounded-xl p-4 border border-[var(--border)] whitespace-pre-wrap text-[var(--text-primary)] min-h-[80px]"
                  {...(form.channel === 'email'
                    ? { dangerouslySetInnerHTML: { __html: preview?.rendered?.htmlBody || '' } }
                    : { children: preview?.rendered?.body || '' })}
                />
                {preview?.unknownVariables?.length > 0 && (
                  <p className="text-xs text-[var(--warning)] font-bold">
                    Unknown: {preview.unknownVariables.map((u) => `{{${u}}}`).join(', ')}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateEditorPage;
