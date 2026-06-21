import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, Pencil, Copy, Star, Trash2, Mail, Eye, LayoutGrid, List } from 'lucide-react';
import Button from '../../../shared/components/Button/Button';
import Modal from '../../../shared/components/Modal/Modal';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { kitService } from '../../../shared/services/kitService';

const SAMPLE_BODY = '<p>Dear Asha Mehta,</p><p>Thank you for connecting with us.</p>';
const VIEW_KEY = 'emailDesignView';

// Render a design to email HTML through the same backend engine used to send.
const fetchPreview = (design) =>
  kitService
    .preview({ channel: 'email', subject: 'Preview', htmlBody: SAMPLE_BODY, emailDesign: design.theme, layout: design.layout || { sections: [] } })
    .then((res) => res?.data?.rendered?.htmlBody || '');

const frameDoc = (html) =>
  `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:14px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;}</style></head><body>${html}</body></html>`;

// Scaled-down card thumbnail.
const DesignThumb = ({ design }) => {
  const [html, setHtml] = useState('');
  useEffect(() => {
    let alive = true;
    fetchPreview(design).then((h) => { if (alive) setHtml(h); }).catch(() => {});
    return () => { alive = false; };
  }, [design]);

  return (
    <div className="rounded-xl overflow-hidden border border-[var(--border)] bg-[#f3f4f6] h-44">
      {html
        ? <iframe title={design.name} sandbox="allow-same-origin" srcDoc={frameDoc(html)}
            style={{ width: '200%', height: '352px', border: 'none', transform: 'scale(0.5)', transformOrigin: 'top left' }} />
        : <div className="h-full flex items-center justify-center text-[var(--text-muted)]"><Loader2 size={20} className="animate-spin opacity-40" /></div>}
    </div>
  );
};

// Full-size preview in a modal.
const PreviewModal = ({ design, onClose }) => {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchPreview(design).then((h) => { if (alive) { setHtml(h); setLoading(false); } }).catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [design]);

  return (
    <Modal isOpen onClose={onClose} title={`Preview — ${design.name}`} className="max-w-2xl">
      {loading
        ? <div className="h-[60vh] flex items-center justify-center text-[var(--text-muted)]"><Loader2 size={28} className="animate-spin opacity-40" /></div>
        : <iframe title="preview" sandbox="allow-same-origin" srcDoc={frameDoc(html)} style={{ width: '100%', height: '68vh', border: 'none' }} />}
    </Modal>
  );
};

// Grid/List switch.
const ViewSwitch = ({ view, onChange }) => (
  <div className="flex items-center gap-1 p-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl">
    {[['grid', LayoutGrid, 'Grid'], ['list', List, 'List']].map(([v, Icon, label]) => (
      <button key={v} type="button" onClick={() => onChange(v)} title={`${label} view`}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
          view === v ? 'bg-[var(--primary)] text-black shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)]'}`}>
        <Icon size={16} /> <span className="hidden sm:inline">{label}</span>
      </button>
    ))}
  </div>
);

const DefaultBadge = () => (
  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-[var(--primary)] bg-[var(--primary)]/10 px-2 py-0.5 rounded-full">
    <Star size={11} /> Default
  </span>
);

const EmailDesignListPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [view, setView] = useState(() => localStorage.getItem(VIEW_KEY) || 'grid');
  const [previewDesign, setPreviewDesign] = useState(null);

  const changeView = (v) => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ } };

  const load = useCallback(async () => {
    try {
      const res = await kitService.listEmailDesigns();
      setDesigns(res?.designs || []);
    } catch (err) {
      toast.error(err?.message || 'Failed to load designs');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const duplicate = async (d) => {
    setBusyId(d._id);
    try { await kitService.duplicateEmailDesign(d._id); toast.success('Design duplicated'); await load(); }
    catch (err) { toast.error(err?.message || 'Failed to duplicate'); }
    finally { setBusyId(null); }
  };

  const makeDefault = async (d) => {
    setBusyId(d._id);
    try { await kitService.setDefaultEmailDesign(d._id); toast.success(`"${d.name}" is now the default`); await load(); }
    catch (err) { toast.error(err?.message || 'Failed to set default'); }
    finally { setBusyId(null); }
  };

  const remove = async (d) => {
    if (!window.confirm(`Delete "${d.name}"? Templates using it will fall back to the default design.`)) return;
    setBusyId(d._id);
    try { await kitService.deleteEmailDesign(d._id); toast.success('Design deleted'); await load(); }
    catch (err) { toast.error(err?.message || 'Failed to delete'); }
    finally { setBusyId(null); }
  };

  // Shared action buttons (icon-only) for both views.
  const Actions = ({ d }) => (
    <>
      <button onClick={() => setPreviewDesign(d)} title="Preview" className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)] transition-colors"><Eye size={15} /></button>
      <button onClick={() => navigate(`/kit/email-designs/${d._id}`)} title="Edit" className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)] transition-colors"><Pencil size={15} /></button>
      <button onClick={() => duplicate(d)} title="Duplicate" className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)] transition-colors"><Copy size={15} /></button>
      {!d.isDefault && <button onClick={() => makeDefault(d)} title="Set as default" className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--bg)] transition-colors"><Star size={15} /></button>}
      {!d.isDefault && <button onClick={() => remove(d)} title="Delete" className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--bg)] transition-colors"><Trash2 size={15} /></button>}
    </>
  );

  return (
    <div className="max-w-[1300px] mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Email Design</h1>
          <p className="text-[var(--text-muted)] font-medium">Reusable email frames. Build several and pick one per Mail Template.</p>
        </div>
        <div className="flex items-center gap-3">
          <ViewSwitch view={view} onChange={changeView} />
          <Button variant="primary" onClick={() => navigate('/kit/email-designs/new')} className="px-5 py-2.5"><Plus size={18} /> New Design</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 text-[var(--text-muted)]">
          <Loader2 size={40} className="animate-spin mb-4 opacity-20" />
          <p className="text-sm font-bold uppercase tracking-widest">Loading designs…</p>
        </div>
      ) : designs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-[var(--text-muted)]">
          <Mail size={40} className="mb-4 opacity-20" />
          <p className="text-sm font-bold mb-4">No designs yet.</p>
          <Button variant="primary" onClick={() => navigate('/kit/email-designs/new')} className="px-5 py-2.5"><Plus size={18} /> Create your first design</Button>
        </div>
      ) : view === 'grid' ? (
        // ── Grid view ──────────────────────────────────────────────────────────
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {designs.map((d) => (
            <div key={d._id} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 space-y-3 hover:border-[var(--primary)]/40 transition-colors">
              <div className="relative group cursor-pointer" onClick={() => setPreviewDesign(d)}>
                <DesignThumb design={d} />
                <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                  <span className="inline-flex items-center gap-1.5 text-white text-sm font-bold bg-black/50 px-3 py-1.5 rounded-lg"><Eye size={16} /> Preview</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="font-black text-[var(--text-primary)] truncate">{d.name}</h3>
                  {d.isDefault && <DefaultBadge />}
                </div>
                {busyId === d._id && <Loader2 size={16} className="animate-spin text-[var(--text-muted)] shrink-0" />}
              </div>
              <div className="flex items-center gap-1 pt-1 border-t border-[var(--border)]">
                <Actions d={d} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        // ── List view ──────────────────────────────────────────────────────────
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl divide-y divide-[var(--border)]">
          {designs.map((d) => (
            <div key={d._id} className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--bg)]/50 transition-colors">
              <button onClick={() => setPreviewDesign(d)} title="Preview"
                className="w-12 h-12 shrink-0 rounded-lg border border-[var(--border)] overflow-hidden" style={{ background: d.theme?.headerColor || '#1f2937' }} />
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/kit/email-designs/${d._id}`)}>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-[var(--text-primary)] truncate">{d.name}</h3>
                  {d.isDefault && <DefaultBadge />}
                </div>
                <p className="text-xs text-[var(--text-muted)] truncate">{(d.layout?.sections?.filter((s) => s.enabled !== false).length || 3)} blocks</p>
              </div>
              {busyId === d._id && <Loader2 size={16} className="animate-spin text-[var(--text-muted)] shrink-0" />}
              <div className="flex items-center gap-1 shrink-0"><Actions d={d} /></div>
            </div>
          ))}
        </div>
      )}

      {previewDesign && <PreviewModal design={previewDesign} onClose={() => setPreviewDesign(null)} />}
    </div>
  );
};

export default EmailDesignListPage;
