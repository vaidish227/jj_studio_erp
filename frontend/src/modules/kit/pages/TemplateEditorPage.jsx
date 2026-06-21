import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Eye, Variable, Upload, FileText, Film, Trash2, Link as LinkIcon, Palette } from 'lucide-react';
import Button from '../../../shared/components/Button/Button';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { kitService } from '../../../shared/services/kitService';
import { CHANNELS, CATEGORIES } from '../constants';
import RichEmailEditor from '../components/RichEmailEditor';

const channelRoute = { whatsapp: '/kit/whatsapp', email: '/kit/mail', notification: '/kit/mail' };

const emptyForm = {
  channel: 'whatsapp', name: '', category: 'custom',
  subject: '', htmlBody: '', textBody: '', body: '', title: '', deepLink: '',
  attachments: [], isActive: true, designId: '',
};

const acceptFor = (t) =>
  t === 'image' ? 'image/*'
  : t === 'video' ? 'video/*'
  : t === 'document' ? '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv'
  : '*/*';

/** Build the create/update payload with only the fields relevant to the channel. */
const buildPayload = (f) => {
  const base = { channel: f.channel, name: f.name.trim(), category: f.category, isActive: f.isActive };
  if (f.channel === 'email') return { ...base, subject: f.subject, htmlBody: f.htmlBody, designId: f.designId || null };
  if (f.channel === 'whatsapp') return {
    ...base, body: f.body,
    attachments: (f.attachments || []).map((a) => ({ kind: a.kind, url: a.url || undefined, key: a.key || undefined, name: a.name || undefined })),
  };
  return { ...base, title: f.title, body: f.body, deepLink: f.deepLink || undefined }; // notification
};

// ── WhatsApp preview (chat bubbles). Text first, then one bubble per attachment
// — exactly how it's delivered (each file is its own message). ──────────────────
const attBubbleContent = (a) => {
  if (a.kind === 'image' && a.url) return <img src={a.url} alt="" className="rounded-md w-full max-h-44 object-cover" />;
  if (a.kind === 'video') return <div className="rounded-md flex items-center gap-2 text-white text-xs px-3 py-4" style={{ background: 'rgba(0,0,0,0.55)' }}><Film size={16} /> {a.name || 'Video'}</div>;
  return <div className="rounded-md flex items-center gap-2 text-[#111b21] text-xs px-3 py-2.5 bg-white border border-black/5"><FileText size={16} /> {a.name || 'Document'}</div>;
};

const WppPreview = ({ text, attachments = [] }) => (
  <div className="rounded-2xl overflow-hidden border border-[var(--border)] shadow-sm">
    <div className="flex items-center gap-2.5 px-4 py-2.5" style={{ background: '#075E54' }}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black" style={{ background: '#ffffff', color: '#075E54' }}>JJ</div>
      <div className="leading-tight">
        <p className="text-sm font-bold text-white">JJ Studio</p>
        <p className="text-[10px] text-white/70">business account</p>
      </div>
    </div>
    <div className="px-3 py-4 min-h-[150px] space-y-2" style={{ background: '#efeae2' }}>
      {((text && text.trim()) || attachments.length === 0) && (
        <div className="max-w-[88%] ml-auto rounded-lg rounded-tr-sm px-2.5 py-2 shadow-sm" style={{ background: '#d9fdd3' }}>
          <p className="text-sm whitespace-pre-wrap" style={{ color: '#111b21' }}>{text || '—'}</p>
          <p className="text-[10px] text-right mt-0.5" style={{ color: '#667781' }}>12:30 PM ✓✓</p>
        </div>
      )}
      {attachments.map((a, i) => (
        <div key={i} className="max-w-[88%] ml-auto rounded-lg rounded-tr-sm p-1.5 shadow-sm" style={{ background: '#d9fdd3' }}>
          {attBubbleContent(a)}
          <p className="text-[10px] text-right mt-0.5 px-1" style={{ color: '#667781' }}>12:30 PM ✓✓</p>
        </div>
      ))}
    </div>
  </div>
);

const TemplateEditorPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = !!id;

  const [form, setForm] = useState({ ...emptyForm, channel: searchParams.get('channel') || 'whatsapp' });
  const [variables, setVariables] = useState([]);
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);

  const activeFieldRef = useRef(null); // last-focused input/textarea, for variable insertion
  const editorInsertRef = useRef(null); // TipTap insert fn for email channel
  const fileInputRef = useRef(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [addKind, setAddKind] = useState('image');
  const [urlDraft, setUrlDraft] = useState('');
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  // ── attachments ─────────────────────────────────────────────────────────────
  const addAttachment = (att) => setForm((prev) => ({ ...prev, attachments: [...(prev.attachments || []), att] }));
  const removeAttachment = (idx) => setForm((prev) => ({ ...prev, attachments: (prev.attachments || []).filter((_, i) => i !== idx) }));

  const handleAddFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    setUploadingMedia(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await kitService.uploadTemplateMedia(fd);
      const data = res?.data || {};
      addAttachment({ kind: addKind, url: data.url || '', key: data.key || '', name: data.filename || file.name });
      toast.success('File attached');
    } catch (err) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploadingMedia(false);
    }
  };
  const handleAddUrl = () => {
    const u = urlDraft.trim();
    if (!u) return;
    addAttachment({ kind: addKind, url: u, key: '', name: u.split('/').pop() || 'link' });
    setUrlDraft('');
  };

  // ── load catalog + (on edit) the template ──────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const v = await kitService.getVariables();
        setVariables(v?.data?.variables || []);
      } catch { /* non-fatal */ }
      try {
        const d = await kitService.listEmailDesigns();
        setDesigns(d?.designs || []);
      } catch { /* non-fatal — email design selector just shows "Default" */ }
      if (isEdit) {
        try {
          const res = await kitService.getTemplate(id);
          const tpl = { ...res.data };
          // Migrate a legacy single attachment into the list for the editor.
          if ((!tpl.attachments || !tpl.attachments.length) && tpl.mediaType && tpl.mediaType !== 'none' && (tpl.mediaUrl || tpl.mediaKey)) {
            tpl.attachments = [{ kind: tpl.mediaType, url: tpl.mediaUrl || '', key: tpl.mediaKey || '', name: 'Attachment' }];
          }
          setForm({ ...emptyForm, ...tpl });
        } catch (err) {
          toast.error(err?.message || 'Failed to load template');
          navigate('/kit/whatsapp');
        } finally {
          setLoading(false);
        }
      }
    })();
    // Only reload when the template id changes. `navigate`/`toast` are used inside
    // for one-off error handling and must NOT be deps — including them re-runs this
    // effect whenever a toast appears, which would re-fetch and wipe unsaved edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  // ── live preview (debounced) ────────────────────────────────────────────────
  const runPreview = useCallback(async (f) => {
    try {
      const res = await kitService.preview({
        channel: f.channel,
        subject: f.subject, htmlBody: f.htmlBody, textBody: f.textBody,
        body: f.body, title: f.title,
        ...(f.channel === 'email' ? { designId: f.designId || undefined } : {}),
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
    // Email channel: delegate to TipTap editor which manages its own cursor.
    if (form.channel === 'email' && editorInsertRef.current) {
      editorInsertRef.current(token);
      return;
    }
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
      const primary = form.channel === 'email' ? 'htmlBody' : 'body';
      set({ [primary]: (form[primary] || '') + token });
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Template name is required');
    if (form.channel === 'email') {
      const stripped = form.htmlBody.replace(/<[^>]*>/g, '').trim();
      if (!stripped) return toast.error('Email body cannot be empty');
    }
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
  const defaultDesignName = designs.find((d) => d.isDefault)?.name;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-[var(--text-muted)]">
        <Loader2 size={40} className="animate-spin mb-4 opacity-20" />
        <p className="text-sm font-bold uppercase tracking-widest">Loading template...</p>
      </div>
    );
  }

  // Group the variable chips by their catalog `group`.
  const VARIABLE_GROUP_ORDER = ['Customer', 'Referral', 'Sales', 'Proposal', 'Project', 'Company', 'Other'];
  const groupedVariables = {};
  for (const v of variables) {
    const g = v.group || 'Other';
    (groupedVariables[g] = groupedVariables[g] || []).push(v);
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
                <label className={labelClass}>Message</label>
                <RichEmailEditor
                  value={form.htmlBody}
                  onChange={(html) => set({ htmlBody: html })}
                  onFocus={() => { activeFieldRef.current = null; }}
                  onInsertRef={(fn) => { editorInsertRef.current = fn; }}
                  placeholder="Dear {{client_name}},&#10;&#10;Thank you for reaching out..."
                />
                <p className="text-xs text-[var(--text-muted)] mt-1.5">
                  Use the toolbar for formatting. Click variable chips to insert at cursor. Use the HTML button to edit raw HTML.
                </p>
              </div>

              {/* Which Email Design (frame) this template wears. Blank = the default. */}
              <div>
                <label className={labelClass}>
                  <span className="inline-flex items-center gap-1.5"><Palette size={13} /> Email Design</span>
                </label>
                <select name="designId" className={fieldClass} value={form.designId || ''}
                  onChange={(e) => set({ designId: e.target.value })}>
                  <option value="">
                    Default design{defaultDesignName ? ` (${defaultDesignName})` : ''}
                  </option>
                  {designs.map((d) => (
                    <option key={d._id} value={d._id}>{d.name}{d.isDefault ? ' — default' : ''}</option>
                  ))}
                </select>
                <p className="text-xs text-[var(--text-muted)] mt-1.5">
                  The header, footer, colours &amp; layout come from the chosen design.{' '}
                  <button type="button" onClick={() => navigate('/kit/email-designs')}
                    className="font-bold text-[var(--primary)] hover:underline">Manage Email Designs</button>.
                </p>
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

              {/* Attachments (multiple) */}
              <div>
                <label className={labelClass}>Attachments (optional)</label>

                {form.attachments?.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {form.attachments.map((a, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2.5">
                        {a.kind === 'image' && a.url
                          ? <img src={a.url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                          : <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">{a.kind === 'video' ? <Film size={18} /> : a.kind === 'document' ? <FileText size={18} /> : <LinkIcon size={18} />}</div>}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[var(--text-primary)] truncate">{a.name || a.url}</p>
                          <p className="text-[11px] text-[var(--text-muted)] capitalize">{a.kind}{a.key ? ' · uploaded' : ' · link'}</p>
                        </div>
                        <button onClick={() => removeAttachment(i)} title="Remove" className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded-xl border border-dashed border-[var(--border)] p-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <select className={`${fieldClass} max-w-[150px]`} value={addKind} onChange={(e) => setAddKind(e.target.value)}>
                      <option value="image">Image</option>
                      <option value="document">Document</option>
                      <option value="video">Video</option>
                    </select>
                    <input ref={fileInputRef} type="file" className="hidden" accept={acceptFor(addKind)} onChange={handleAddFile} />
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadingMedia} className="px-4 py-2">
                      {uploadingMedia ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Upload file
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input className={`${fieldClass} flex-1 min-w-[200px]`} value={urlDraft}
                      onChange={(e) => setUrlDraft(e.target.value)} placeholder="…or paste a link / URL, then Add" />
                    <Button variant="ghost" onClick={handleAddUrl} disabled={!urlDraft.trim()} className="px-3 py-2">Add link</Button>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    Add as many as you like (max 16 MB each). On WhatsApp each file is sent as its own message, in order, after the text.
                  </p>
                </div>
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
            <p className="text-xs text-[var(--text-muted)] mb-3">Click to insert at cursor. Hover a chip to see its code.</p>
            <div className="space-y-3">
              {VARIABLE_GROUP_ORDER.filter((g) => groupedVariables[g]?.length).map((g) => (
                <div key={g}>
                  <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-1.5">{g}</p>
                  <div className="flex flex-wrap gap-2">
                    {groupedVariables[g].map((v) => (
                      <button key={v.key} onClick={() => insertVariable(v.key)} title={`{{${v.key}}}`}
                        className="px-2.5 py-1 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-xs font-bold text-[var(--text-primary)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors">
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
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
            ) : form.channel === 'whatsapp' ? (
              <div className="space-y-2">
                <WppPreview text={preview?.rendered?.body || ''} attachments={form.attachments || []} />
                {preview?.unknownVariables?.length > 0 && (
                  <p className="text-xs text-[var(--warning)] font-bold">Unknown: {preview.unknownVariables.map((u) => `{{${u}}}`).join(', ')}</p>
                )}
              </div>
            ) : form.channel === 'email' ? (
              <div className="space-y-2 text-sm">
                <p><span className="font-bold text-[var(--text-muted)]">Subject: </span>{preview?.rendered?.subject}</p>
                <div className="rounded-xl overflow-hidden border border-[var(--border)]" style={{ height: '420px' }}>
                  <iframe
                    srcDoc={preview?.rendered?.htmlBody
                      ? `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:16px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;}</style></head><body>${preview.rendered.htmlBody}</body></html>`
                      : '<html><body style="margin:16px;color:#9ca3af;font-size:13px;">Preview will appear here...</body></html>'
                    }
                    title="Email Preview"
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    sandbox="allow-same-origin"
                  />
                </div>
                {preview?.unknownVariables?.length > 0 && (
                  <p className="text-xs text-[var(--warning)] font-bold">
                    Unknown: {preview.unknownVariables.map((u) => `{{${u}}}`).join(', ')}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                {form.channel === 'notification' && (
                  <p className="font-bold text-[var(--text-primary)]">{preview?.rendered?.title}</p>
                )}
                <div className="bg-[var(--bg)] rounded-xl p-4 border border-[var(--border)] whitespace-pre-wrap text-[var(--text-primary)] min-h-[80px]">
                  {preview?.rendered?.body || ''}
                </div>
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
