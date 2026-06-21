import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Loader2, Eye, Palette, Plus, Trash2, ChevronUp, ChevronDown,
  Image as ImageIcon, FileText, Link as LinkIcon, Minus, MoveVertical,
  Type, Share2, RotateCcw, Settings2, Upload, Star,
} from 'lucide-react';
import Button from '../../../shared/components/Button/Button';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { kitService } from '../../../shared/services/kitService';
import EmailDesignFields from '../components/EmailDesignFields';

const fieldClass = 'w-full px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] transition-colors';
const labelClass = 'block text-xs font-black uppercase tracking-wider text-[var(--text-muted)] mb-1.5';

const SAMPLE_BODY = '<p>Dear Asha Mehta,</p><p>Thank you for connecting with us. This is how your branded emails will look.</p>';

// Social platforms — keys + initials + colours MUST match the backend
// SOCIAL_PLATFORMS map in emailLayout.js so the builder badge mirrors the email.
const SOCIAL_PLATFORMS = {
  instagram: { label: 'Instagram',   initial: 'Ig', color: '#E4405F' },
  facebook:  { label: 'Facebook',    initial: 'f',  color: '#1877F2' },
  linkedin:  { label: 'LinkedIn',    initial: 'in', color: '#0A66C2' },
  x:         { label: 'X (Twitter)', initial: 'X',  color: '#000000' },
  youtube:   { label: 'YouTube',     initial: 'Yt', color: '#FF0000' },
  whatsapp:  { label: 'WhatsApp',    initial: 'Wa', color: '#25D366' },
  website:   { label: 'Website',     initial: 'W',  color: '#6B7280' },
};
const PLATFORM_KEYS = Object.keys(SOCIAL_PLATFORMS);

const BLOCK_META = {
  header:    { label: 'Header / Logo', icon: ImageIcon, removable: false, hint: 'Uses the brand colour, logo & brand text from the Theme tab.' },
  image:     { label: 'Image / Banner', icon: ImageIcon },
  body:      { label: 'Message Body', icon: FileText, required: true, removable: false, hint: 'Each template’s message renders here — nothing to configure.' },
  button:    { label: 'Button (CTA)', icon: LinkIcon },
  divider:   { label: 'Divider', icon: Minus },
  spacer:    { label: 'Spacer', icon: MoveVertical },
  signature: { label: 'Signature', icon: Type },
  social:    { label: 'Social Links', icon: Share2 },
  footer:    { label: 'Footer', icon: FileText, removable: false, hint: 'Uses the footer text from the Theme tab.' },
};
const ADDABLE = ['image', 'button', 'divider', 'spacer', 'signature', 'social'];

const DEFAULT_SECTIONS = [
  { key: 'header', enabled: true, props: { align: 'left' } },
  { key: 'body', enabled: true, props: {} },
  { key: 'footer', enabled: true, props: {} },
];

const defaultProps = (key) => ({
  header:    { align: 'left' },
  image:     { url: '', key: '', align: 'center', width: '' },
  button:    { text: 'View details', url: '', bgColor: '', textColor: '#ffffff', align: 'left' },
  divider:   { color: '#eeeeee' },
  spacer:    { height: 16 },
  signature: { text: 'Warm regards,\nThe Team', color: '' },
  social:    { links: [], align: 'left' },
}[key] || {});

const clone = (arr) => arr.map((s) => ({ ...s, props: JSON.parse(JSON.stringify(s.props || {})) }));

const ColorInput = ({ value, onChange, placeholder }) => (
  <div className="flex items-center gap-2">
    <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(value || '') ? value : '#000000'}
      onChange={(e) => onChange(e.target.value)}
      className="w-9 h-9 shrink-0 rounded-lg border border-[var(--border)] bg-transparent cursor-pointer p-0.5" />
    <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || '#000000'} className={`${fieldClass} flex-1`} />
  </div>
);

const AlignField = ({ value, onChange }) => (
  <div>
    <label className={labelClass}>Alignment</label>
    <div className="flex gap-1.5">
      {['left', 'center', 'right'].map((a) => (
        <button key={a} type="button" onClick={() => onChange(a)}
          className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold capitalize border transition-colors ${
            (value || 'left') === a
              ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
              : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--primary)]'
          }`}>{a}</button>
      ))}
    </div>
  </div>
);

// One social link row — platform picker + url + optional custom icon upload.
const SocialLinkRow = ({ link, onChange, onRemove }) => {
  const toast = useToast();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const plat = SOCIAL_PLATFORMS[link.platform] || SOCIAL_PLATFORMS.website;

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await kitService.uploadTemplateMedia(fd);
      const payload = res?.data?.data || res?.data || res || {};
      if (!payload.url) { toast.error('Upload returned no URL'); return; }
      onChange({ ...link, iconUrl: payload.url, iconKey: payload.key || '' });
      toast.success('Icon uploaded');
    } catch (err) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center overflow-hidden text-white text-[11px] font-black" style={{ background: link.iconUrl ? 'transparent' : plat.color }}>
        {link.iconUrl ? <img src={link.iconUrl} alt="" className="w-full h-full object-cover" /> : plat.initial}
      </div>
      <select className={`${fieldClass} max-w-[130px]`} value={link.platform || 'website'} onChange={(e) => onChange({ ...link, platform: e.target.value })}>
        {PLATFORM_KEYS.map((k) => <option key={k} value={k}>{SOCIAL_PLATFORMS[k].label}</option>)}
      </select>
      <input className={`${fieldClass} flex-1`} value={link.url || ''} onChange={(e) => onChange({ ...link, url: e.target.value })} placeholder="https://…" />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={upload} />
      <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
        title="Upload custom icon (optional)" className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--primary)]">
        {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
      </button>
      <button type="button" onClick={onRemove} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--error)]"><Trash2 size={15} /></button>
    </div>
  );
};

const BlockSettings = ({ section, onChange }) => {
  const toast = useToast();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const p = section.props || {};
  const set = (patch) => onChange({ ...p, ...patch });

  const handleImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await kitService.uploadTemplateMedia(fd);
      const payload = res?.data?.data || res?.data || res || {};
      if (!payload.url) { toast.error('Upload returned no URL'); return; }
      set({ url: payload.url, key: payload.key || '' });
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  switch (section.key) {
    case 'header':
      return <AlignField value={p.align} onChange={(align) => set({ align })} />;

    case 'image':
      return (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Image</label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--bg)] flex items-center justify-center overflow-hidden">
                {p.url ? <img src={p.url} alt="" className="max-w-full max-h-full object-contain" /> : <ImageIcon size={20} className="text-[var(--text-muted)] opacity-40" />}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="px-4 py-2">
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} {p.url ? 'Replace' : 'Upload'}
              </Button>
              {p.url && <button type="button" onClick={() => set({ url: '', key: '' })} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--error)]"><Trash2 size={16} /></button>}
            </div>
          </div>
          <div>
            <label className={labelClass}>Width (optional)</label>
            <input className={fieldClass} value={p.width || ''} onChange={(e) => set({ width: e.target.value })} placeholder="e.g. 200px or 100%" />
          </div>
          <AlignField value={p.align} onChange={(align) => set({ align })} />
        </div>
      );

    case 'button':
      return (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Button text</label>
            <input className={fieldClass} value={p.text || ''} onChange={(e) => set({ text: e.target.value })} placeholder="View details" />
          </div>
          <div>
            <label className={labelClass}>Link URL</label>
            <input className={fieldClass} value={p.url || ''} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelClass}>Background</label><ColorInput value={p.bgColor} onChange={(v) => set({ bgColor: v })} placeholder="Accent colour" /></div>
            <div><label className={labelClass}>Text colour</label><ColorInput value={p.textColor} onChange={(v) => set({ textColor: v })} placeholder="#ffffff" /></div>
          </div>
          <AlignField value={p.align} onChange={(align) => set({ align })} />
        </div>
      );

    case 'divider':
      return <div><label className={labelClass}>Line colour</label><ColorInput value={p.color} onChange={(v) => set({ color: v })} placeholder="#eeeeee" /></div>;

    case 'spacer':
      return (
        <div>
          <label className={labelClass}>Height (px)</label>
          <input type="number" min={0} max={120} className={fieldClass} value={p.height ?? 16} onChange={(e) => set({ height: Number(e.target.value) })} />
        </div>
      );

    case 'signature':
      return (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Signature text</label>
            <textarea rows={3} className={fieldClass} value={p.text || ''} onChange={(e) => set({ text: e.target.value })} placeholder={'Warm regards,\nThe Team'} />
            <p className="text-[11px] text-[var(--text-muted)] mt-1">Line breaks are preserved.</p>
          </div>
          <div><label className={labelClass}>Text colour (optional)</label><ColorInput value={p.color} onChange={(v) => set({ color: v })} placeholder="Body text colour" /></div>
        </div>
      );

    case 'social': {
      const links = Array.isArray(p.links) ? p.links : [];
      const setLink = (i, next) => set({ links: links.map((l, idx) => (idx === i ? next : l)) });
      const addLink = () => set({ links: [...links, { platform: 'instagram', url: '', iconKey: '', iconUrl: '' }] });
      const removeLink = (i) => set({ links: links.filter((_, idx) => idx !== i) });
      return (
        <div className="space-y-3">
          {links.map((l, i) => (
            <SocialLinkRow key={i} link={l} onChange={(next) => setLink(i, next)} onRemove={() => removeLink(i)} />
          ))}
          <Button variant="ghost" onClick={addLink} className="px-3 py-1.5"><Plus size={15} /> Add social link</Button>
          <p className="text-[11px] text-[var(--text-muted)]">Each shows a brand-coloured badge; upload a custom icon to override it.</p>
          <AlignField value={p.align} onChange={(align) => set({ align })} />
        </div>
      );
    }

    default:
      return <p className="text-sm text-[var(--text-muted)]">{BLOCK_META[section.key]?.hint || 'No settings for this block.'}</p>;
  }
};

const EmailDesignEditorPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { id } = useParams();
  const isEdit = !!id;

  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [theme, setTheme] = useState({});
  const [sections, setSections] = useState(clone(DEFAULT_SECTIONS));
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState('theme');
  const [addOpen, setAddOpen] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const res = await kitService.getEmailDesign(id);
        const d = res?.design || {};
        setName(d.name || '');
        setIsDefault(!!d.isDefault);
        setTheme(d.theme || {});
        const loaded = d.layout?.sections;
        setSections(Array.isArray(loaded) && loaded.length ? clone(loaded) : clone(DEFAULT_SECTIONS));
      } catch (err) {
        toast.error(err?.message || 'Failed to load design');
        navigate('/kit/email-designs');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await kitService.preview({
          channel: 'email', subject: 'Preview', htmlBody: SAMPLE_BODY,
          emailDesign: theme, layout: { sections },
        });
        setPreviewHtml(res?.data?.rendered?.htmlBody || '');
      } catch { /* best-effort */ }
    }, 500);
    return () => clearTimeout(t);
  }, [theme, sections]);

  const patchTheme = (p) => setTheme((prev) => ({ ...prev, ...p }));
  const patchSelectedProps = (props) => setSections((prev) => prev.map((s, i) => (i === selected ? { ...s, props } : s)));
  const toggleSection = (i) => setSections((prev) => prev.map((s, idx) => (idx === i ? { ...s, enabled: s.enabled === false } : s)));

  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= sections.length) return;
    setSections((prev) => { const next = clone(prev); [next[i], next[j]] = [next[j], next[i]]; return next; });
    if (selected === i) setSelected(j);
    else if (selected === j) setSelected(i);
  };

  const removeSection = (i) => {
    setSections((prev) => prev.filter((_, idx) => idx !== i));
    setSelected((sel) => (sel >= i && sel > 0 ? sel - 1 : sel));
  };

  const addBlock = (key) => {
    setAddOpen(false);
    const next = clone(sections);
    const footerIdx = next.findIndex((s) => s.key === 'footer');
    const at = footerIdx >= 0 ? footerIdx : next.length;
    next.splice(at, 0, { key, enabled: true, props: defaultProps(key) });
    setSections(next);
    setSelected(at);
    setTab('block');
  };

  const selectBlock = (i) => { setSelected(i); setTab('block'); };
  const resetLayout = () => { setSections(clone(DEFAULT_SECTIONS)); setSelected(0); toast.success('Layout reset to default'); };

  const save = async () => {
    if (!name.trim()) { toast.error('Give this design a name'); return; }
    setSaving(true);
    try {
      const payload = { name: name.trim(), theme, layout: { sections }, isDefault };
      if (isEdit) {
        await kitService.updateEmailDesign(id, payload);
        toast.success('Design saved');
      } else {
        const res = await kitService.createEmailDesign(payload);
        toast.success('Design created');
        const newId = res?.design?._id;
        if (newId) navigate(`/kit/email-designs/${newId}`, { replace: true });
        else navigate('/kit/email-designs');
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-[var(--text-muted)]">
        <Loader2 size={40} className="animate-spin mb-4 opacity-20" />
        <p className="text-sm font-bold uppercase tracking-widest">Loading design…</p>
      </div>
    );
  }

  const current = sections[selected];

  return (
    <div className="max-w-[1500px] mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/kit/email-designs')} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] rounded-lg transition-colors shrink-0">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">{isEdit ? 'Edit Email Design' : 'New Email Design'}</h1>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-xl border border-[var(--border)]" title="Use this design for automations and as the fallback">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="w-4 h-4 accent-[var(--primary)]" />
              <Star size={15} className={isDefault ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'} />
              <span className="text-sm font-bold text-[var(--text-secondary)]">Default</span>
            </label>
            <Button variant="outline" onClick={resetLayout} className="px-4 py-2.5"><RotateCcw size={16} /> Reset layout</Button>
            <Button variant="primary" onClick={save} disabled={saving} className="px-6 py-2.5">
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} {isEdit ? 'Save Changes' : 'Create Design'}
            </Button>
          </div>
        </div>

        {/* Design name — a clear, required field */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 max-w-2xl">
          <label className={labelClass}>Design Name <span className="text-[var(--error)]">*</span></label>
          <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Default, Festive Campaign, Minimal" autoFocus={!isEdit} />
          <p className="text-[11px] text-[var(--text-muted)] mt-1.5">Give this design a clear name so it's easy to pick when creating a Mail Template.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: layout blocks */}
        <div className="lg:col-span-3 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-black text-sm uppercase tracking-wider text-[var(--text-primary)]">Layout Blocks</h3>
            <div className="relative">
              <Button variant="ghost" onClick={() => setAddOpen((o) => !o)} className="px-2.5 py-1.5"><Plus size={16} /> Add</Button>
              {addOpen && (
                <div className="absolute right-0 mt-1 w-48 z-20 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg py-1">
                  {ADDABLE.map((key) => {
                    const Icon = BLOCK_META[key].icon;
                    return (
                      <button key={key} onClick={() => addBlock(key)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-bold text-[var(--text-secondary)] hover:bg-[var(--bg)] transition-colors">
                        <Icon size={15} /> {BLOCK_META[key].label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            {sections.map((s, i) => {
              const meta = BLOCK_META[s.key] || { label: s.key, icon: FileText };
              const Icon = meta.icon;
              const off = s.enabled === false;
              return (
                <div key={`${s.key}-${i}`} onClick={() => selectBlock(i)}
                  className={`group flex items-center gap-2 px-2.5 py-2 rounded-xl border cursor-pointer transition-colors ${
                    selected === i ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-[var(--border)] hover:border-[var(--primary)]/40'
                  } ${off ? 'opacity-50' : ''}`}>
                  <input type="checkbox" checked={!off} onClick={(e) => e.stopPropagation()} onChange={() => toggleSection(i)}
                    className="w-4 h-4 accent-[var(--primary)] shrink-0" title={meta.required ? 'Required' : 'Show / hide'} disabled={meta.required} />
                  <Icon size={15} className="shrink-0 text-[var(--text-muted)]" />
                  <span className="flex-1 text-sm font-bold text-[var(--text-primary)] truncate">{meta.label}</span>
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); move(i, -1); }} disabled={i === 0}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-20"><ChevronUp size={15} /></button>
                    <button onClick={(e) => { e.stopPropagation(); move(i, 1); }} disabled={i === sections.length - 1}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-20"><ChevronDown size={15} /></button>
                    {meta.removable !== false
                      ? <button onClick={(e) => { e.stopPropagation(); removeSection(i); }} className="p-1 text-[var(--text-muted)] hover:text-[var(--error)]"><Trash2 size={14} /></button>
                      : <span className="w-[22px]" />}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mt-3">Toggle to show/hide, arrows to reorder. The body block is always present.</p>
        </div>

        {/* Middle: theme / block settings */}
        <div className="lg:col-span-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex gap-1.5 mb-5 p-1 bg-[var(--bg)] rounded-xl w-fit">
            <button onClick={() => setTab('theme')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${tab === 'theme' ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)]'}`}>
              <Palette size={14} /> Theme
            </button>
            <button onClick={() => setTab('block')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${tab === 'block' ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)]'}`}>
              <Settings2 size={14} /> {current ? (BLOCK_META[current.key]?.label || 'Block') : 'Block'}
            </button>
          </div>

          {tab === 'theme' ? (
            <EmailDesignFields design={theme} onChange={patchTheme} />
          ) : current ? (
            <div className="space-y-4">
              {BLOCK_META[current.key]?.hint && (
                <p className="text-xs text-[var(--text-muted)] bg-[var(--bg)] rounded-lg px-3 py-2">{BLOCK_META[current.key].hint}</p>
              )}
              <BlockSettings section={current} onChange={patchSelectedProps} />
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Select a block on the left to edit it.</p>
          )}
        </div>

        {/* Right: live preview */}
        <div className="lg:col-span-5 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3 text-[var(--text-primary)]">
            <Eye size={16} /><h3 className="font-black text-sm uppercase tracking-wider">Live Preview</h3>
          </div>
          <p className="text-xs text-[var(--text-muted)] mb-3">Rendered with sample data, through the same engine used to send.</p>
          <div className="rounded-xl overflow-hidden border border-[var(--border)]" style={{ height: '640px' }}>
            <iframe
              srcDoc={previewHtml
                ? `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:16px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;}</style></head><body>${previewHtml}</body></html>`
                : '<html><body style="margin:16px;color:#9ca3af;font-size:13px;">Preview…</body></html>'}
              title="Email Preview"
              style={{ width: '100%', height: '100%', border: 'none' }}
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailDesignEditorPage;
