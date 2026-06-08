import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Loader2, Plus, Trash2, ChevronUp, ChevronDown,
  Clock, Users, X, Check, Megaphone, Play, Pause,
} from 'lucide-react';
import Button from '../../../shared/components/Button/Button';
import { ConfirmationModal } from '../../../shared/components';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { kitService } from '../../../shared/services/kitService';
import { crmService } from '../../../shared/services/crmService';
import { CHANNELS, AUDIENCES, DELAY_UNITS, CAMPAIGN_STATUS_META } from '../constants';

const fieldClass = 'w-full px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] transition-colors';
const labelClass = 'block text-xs font-black uppercase tracking-wider text-[var(--text-muted)] mb-1.5';

const emptyStep = { channel: 'whatsapp', templateId: '', delay: { value: 2, unit: 'days' }, name: '' };

// ─── Enroll modal ───────────────────────────────────────────────────────────
const EnrollModal = ({ campaignId, onClose, onDone }) => {
  const toast = useToast();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // /clients/get paginates (default 10) and returns { clients, leads } at
        // the top level of the response body — request a high limit and read
        // from the right keys.
        const res = await crmService.getLeads({ limit: 500 });
        const list = res?.clients || res?.leads || res?.data?.clients || res?.data || [];
        setLeads(Array.isArray(list) ? list : []);
      } catch (err) {
        toast.error(err?.message || 'Failed to load leads');
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const filtered = leads.filter((l) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [l.name, l.phone, l.email].some((f) => (f || '').toLowerCase().includes(q));
  });

  const toggle = (id) => setSelected((p) => ({ ...p, [id]: !p[id] }));
  const ids = Object.keys(selected).filter((k) => selected[k]);

  const submit = async () => {
    if (!ids.length) return;
    setSubmitting(true);
    try {
      const res = await kitService.enroll(campaignId, { entityType: 'lead', entityIds: ids });
      const r = res.data || {};
      toast.success(`Enrolled ${r.enrolled?.length || 0}, skipped ${r.skipped?.length || 0}`);
      onDone?.();
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Enrollment failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--bg)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h3 className="font-black text-[var(--text-primary)] flex items-center gap-2"><Users size={18} /> Enroll Leads</h3>
          <button onClick={onClose} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg"><X size={18} /></button>
        </div>
        <div className="p-4 border-b border-[var(--border)]">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leads..." className={fieldClass} />
        </div>
        <div className="flex-1 overflow-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-[var(--text-muted)]"><Loader2 size={28} className="animate-spin opacity-30" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-[var(--text-muted)] py-12">No leads found.</p>
          ) : filtered.map((l) => (
            <button key={l._id} onClick={() => toggle(l._id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--surface)] transition-colors text-left">
              <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${selected[l._id] ? 'bg-[var(--primary)] border-[var(--primary)] text-white' : 'border-[var(--border)]'}`}>
                {selected[l._id] && <Check size={14} />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-[var(--text-primary)] truncate">{l.name || 'Unnamed'}</span>
                <span className="block text-xs text-[var(--text-muted)] truncate">{l.phone || l.email || '—'}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[var(--border)]">
          <span className="text-sm text-[var(--text-muted)] font-medium">{ids.length} selected</span>
          <Button variant="primary" onClick={submit} disabled={!ids.length || submitting} className="px-5 py-2">
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Enroll
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Step editor row ──────────────────────────────────────────────────────────
const StepForm = ({ value, onChange, onSubmit, onCancel, submitting }) => {
  const [templates, setTemplates] = useState([]);
  const [loadingT, setLoadingT] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingT(true);
      try {
        const res = await kitService.getTemplates({ channel: value.channel, isActive: true });
        setTemplates(res?.data?.templates || []);
      } catch { setTemplates([]); }
      finally { setLoadingT(false); }
    })();
  }, [value.channel]);

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className={labelClass}>Send after</label>
          <input type="number" min={0} className={fieldClass} value={value.delay.value}
            onChange={(e) => onChange({ ...value, delay: { ...value.delay, value: Number(e.target.value) } })} />
        </div>
        <div>
          <label className={labelClass}>Unit</label>
          <select className={fieldClass} value={value.delay.unit}
            onChange={(e) => onChange({ ...value, delay: { ...value.delay, unit: e.target.value } })}>
            {DELAY_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Channel</label>
          <select className={fieldClass} value={value.channel}
            onChange={(e) => onChange({ ...value, channel: e.target.value, templateId: '' })}>
            {Object.values(CHANNELS).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Template</label>
          <select className={fieldClass} value={value.templateId} disabled={loadingT}
            onChange={(e) => onChange({ ...value, templateId: e.target.value })}>
            <option value="">{loadingT ? 'Loading...' : 'Select template'}</option>
            {templates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} className="px-4 py-2">Cancel</Button>
        <Button variant="primary" onClick={onSubmit} disabled={!value.templateId || submitting} className="px-4 py-2">
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save Step
        </Button>
      </div>
    </div>
  );
};

// ─── Builder page ─────────────────────────────────────────────────────────────
const CampaignBuilderPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { id } = useParams();
  const isEdit = !!id;

  const [meta, setMeta] = useState({ name: '', description: '', audience: 'leads', defaultChannel: 'whatsapp' });
  const [status, setStatus] = useState('draft');
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [savingMeta, setSavingMeta] = useState(false);

  const [stepDraft, setStepDraft] = useState(null);   // null = closed; {…} = open form
  const [editingStepId, setEditingStepId] = useState(null);
  const [savingStep, setSavingStep] = useState(false);
  const [deleteStepId, setDeleteStepId] = useState(null);
  const [enrollOpen, setEnrollOpen] = useState(false);

  const load = useCallback(async () => {
    if (!isEdit) return;
    setLoading(true);
    try {
      const res = await kitService.getCampaign(id);
      const c = res.data;
      setMeta({ name: c.name, description: c.description || '', audience: c.audience, defaultChannel: c.defaultChannel });
      setStatus(c.status);
      setSteps(c.steps || []);
    } catch (err) {
      toast.error(err?.message || 'Failed to load campaign');
      navigate('/kit/campaigns');
    } finally {
      setLoading(false);
    }
  }, [id, isEdit, navigate, toast]);

  useEffect(() => { load(); }, [load]);

  const saveMeta = async () => {
    if (!meta.name.trim()) return toast.error('Campaign name is required');
    setSavingMeta(true);
    try {
      if (isEdit) {
        await kitService.updateCampaign(id, meta);
        toast.success('Campaign saved');
      } else {
        const res = await kitService.createCampaign(meta);
        toast.success('Campaign created');
        navigate(`/kit/campaigns/${res.data._id}`);
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to save campaign');
    } finally {
      setSavingMeta(false);
    }
  };

  const toggleStatus = async () => {
    const next = status === 'active' ? 'paused' : 'active';
    try {
      const res = await kitService.updateCampaign(id, { status: next });
      setStatus(res.data.status);
      toast.success(next === 'active' ? 'Campaign activated' : 'Campaign paused');
    } catch (err) {
      toast.error(err?.message || 'Failed to update status');
    }
  };

  const openAddStep = () => { setEditingStepId(null); setStepDraft({ ...emptyStep }); };
  const openEditStep = (s) => {
    setEditingStepId(s._id);
    setStepDraft({ channel: s.channel, templateId: s.templateId?._id || s.templateId, delay: s.delay || { value: 0, unit: 'days' }, name: s.name || '' });
  };

  const submitStep = async () => {
    setSavingStep(true);
    try {
      if (editingStepId) {
        await kitService.updateStep(id, editingStepId, stepDraft);
        toast.success('Step updated');
      } else {
        await kitService.addStep(id, stepDraft);
        toast.success('Step added');
      }
      setStepDraft(null); setEditingStepId(null);
      load();
    } catch (err) {
      toast.error(err?.message || 'Failed to save step');
    } finally {
      setSavingStep(false);
    }
  };

  const removeStep = async () => {
    try {
      await kitService.deleteStep(id, deleteStepId);
      toast.success('Step removed');
      setDeleteStepId(null);
      load();
    } catch (err) {
      toast.error(err?.message || 'Failed to remove step');
    }
  };

  const move = async (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= steps.length) return;
    const reordered = [...steps];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setSteps(reordered);
    try {
      await kitService.reorderSteps(id, reordered.map((s) => s._id));
    } catch (err) {
      toast.error(err?.message || 'Failed to reorder');
      load();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-[var(--text-muted)]">
        <Loader2 size={40} className="animate-spin mb-4 opacity-20" />
        <p className="text-sm font-bold uppercase tracking-widest">Loading campaign...</p>
      </div>
    );
  }

  const statusMeta = CAMPAIGN_STATUS_META[status] || CAMPAIGN_STATUS_META.draft;
  const channelLabel = (ch) => CHANNELS[ch]?.label || ch;

  return (
    <div className="max-w-[1100px] mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/kit/campaigns')} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Megaphone size={22} className="text-[var(--primary)]" />
            <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">{isEdit ? 'Edit Campaign' : 'New Campaign'}</h1>
          </div>
          {isEdit && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold ml-2" style={{ color: statusMeta.color }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusMeta.color }} /> {statusMeta.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEdit && status !== 'archived' && (
            <Button variant="outline" onClick={toggleStatus} className="px-4 py-2.5">
              {status === 'active' ? <><Pause size={16} /> Pause</> : <><Play size={16} /> Activate</>}
            </Button>
          )}
          {isEdit && (
            <Button variant="outline" onClick={() => setEnrollOpen(true)} className="px-4 py-2.5"><Users size={16} /> Enroll</Button>
          )}
          <Button variant="primary" onClick={saveMeta} disabled={savingMeta} className="px-5 py-2.5">
            {savingMeta ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {isEdit ? 'Save' : 'Create'}
          </Button>
        </div>
      </div>

      {/* Meta */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Campaign Name</label>
            <input className={fieldClass} value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} placeholder="e.g. Lead Evaluation Journey" />
          </div>
          <div>
            <label className={labelClass}>Audience</label>
            <select className={fieldClass} value={meta.audience} onChange={(e) => setMeta({ ...meta, audience: e.target.value })}>
              {AUDIENCES.map((a) => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass}>Description</label>
          <input className={fieldClass} value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} placeholder="Optional" />
        </div>
      </div>

      {/* Steps */}
      {!isEdit ? (
        <p className="text-sm text-[var(--text-muted)] text-center py-6">Create the campaign first, then add steps.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-[var(--text-primary)]">Steps</h2>
            {!stepDraft && <Button variant="outline" onClick={openAddStep} className="px-4 py-2"><Plus size={16} /> Add Step</Button>}
          </div>

          {steps.length === 0 && !stepDraft && (
            <div className="bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-2xl p-10 text-center text-[var(--text-muted)]">
              No steps yet. Add the first message in the journey.
            </div>
          )}

          {steps.map((s, i) => (
            <div key={s._id} className="bg-[var(--bg)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-4">
              <div className="flex flex-col gap-1">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="text-[var(--text-muted)] hover:text-[var(--primary)] disabled:opacity-20"><ChevronUp size={16} /></button>
                <button onClick={() => move(i, 1)} disabled={i === steps.length - 1} className="text-[var(--text-muted)] hover:text-[var(--primary)] disabled:opacity-20"><ChevronDown size={16} /></button>
              </div>
              <div className="w-8 h-8 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-black text-sm shrink-0">{i + 1}</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[var(--text-primary)]">{s.templateId?.name || 'Template'}</p>
                <p className="text-xs text-[var(--text-muted)] flex items-center gap-3 mt-0.5">
                  <span className="inline-flex items-center gap-1"><Clock size={12} /> after {s.delay?.value} {s.delay?.unit}</span>
                  <span className="capitalize">{channelLabel(s.channel)}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openEditStep(s)} className="text-xs font-bold text-[var(--text-muted)] hover:text-[var(--primary)] px-2 py-1">Edit</button>
                <button onClick={() => setDeleteStepId(s._id)} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 rounded-lg"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}

          {stepDraft && (
            <StepForm value={stepDraft} onChange={setStepDraft} onSubmit={submitStep}
              onCancel={() => { setStepDraft(null); setEditingStepId(null); }} submitting={savingStep} />
          )}
        </div>
      )}

      {enrollOpen && <EnrollModal campaignId={id} onClose={() => setEnrollOpen(false)} onDone={load} />}

      <ConfirmationModal
        isOpen={!!deleteStepId}
        onClose={() => setDeleteStepId(null)}
        onConfirm={removeStep}
        title="Remove Step"
        message="Remove this step from the campaign?"
        confirmLabel="Remove"
        variant="danger"
      />
    </div>
  );
};

export default CampaignBuilderPage;
