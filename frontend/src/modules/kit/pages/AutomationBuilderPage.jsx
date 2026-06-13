import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Plus, Trash2, Zap, Filter, Play, Power } from 'lucide-react';
import Button from '../../../shared/components/Button/Button';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { kitService } from '../../../shared/services/kitService';
import { CHANNELS, DELAY_UNITS, OPERATORS, ACTION_TYPES } from '../constants';

const fieldClass = 'w-full px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] transition-colors';
const labelClass = 'block text-xs font-black uppercase tracking-wider text-[var(--text-muted)] mb-1.5';

const emptyCondition = { field: '', operator: 'eq', value: '' };
const emptyAction = { type: 'start_campaign', campaignId: '', templateId: '', channel: 'whatsapp', delay: { value: 0, unit: 'days' }, params: { title: '', message: '' } };

// ─── One THEN action row ──────────────────────────────────────────────────────
const ActionRow = ({ action, campaigns, onChange, onRemove }) => {
  const [templates, setTemplates] = useState([]);
  useEffect(() => {
    if (action.type !== 'send_template') return;
    (async () => {
      try {
        const res = await kitService.getTemplates({ channel: action.channel, isActive: true });
        setTemplates(res?.data?.templates || []);
      } catch { setTemplates([]); }
    })();
  }, [action.type, action.channel]);

  return (
    <div className="bg-[var(--bg)] border border-[var(--border)] rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <select className={fieldClass} value={action.type} onChange={(e) => onChange({ ...action, type: e.target.value })}>
          {ACTION_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
        <button onClick={onRemove} className="p-2 text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 rounded-lg shrink-0"><Trash2 size={16} /></button>
      </div>

      {(action.type === 'start_campaign' || action.type === 'stop_campaign') && (
        <select className={fieldClass} value={action.campaignId} onChange={(e) => onChange({ ...action, campaignId: e.target.value })}>
          <option value="">Select campaign</option>
          {campaigns.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
      )}

      {action.type === 'send_template' && (
        <div className="grid grid-cols-2 gap-3">
          <select className={fieldClass} value={action.channel} onChange={(e) => onChange({ ...action, channel: e.target.value, templateId: '' })}>
            {Object.values(CHANNELS).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <select className={fieldClass} value={action.templateId} onChange={(e) => onChange({ ...action, templateId: e.target.value })}>
            <option value="">Select template</option>
            {templates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
        </div>
      )}

      {action.type === 'notify' && (
        <div className="space-y-2">
          <input className={fieldClass} placeholder="Notification title (supports {{vars}})" value={action.params?.title || ''}
            onChange={(e) => onChange({ ...action, params: { ...action.params, title: e.target.value } })} />
          <input className={fieldClass} placeholder="Message" value={action.params?.message || ''}
            onChange={(e) => onChange({ ...action, params: { ...action.params, message: e.target.value } })} />
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-[var(--text-muted)]">Delay</span>
        <input type="number" min={0} className={`${fieldClass} w-20`} value={action.delay?.value ?? 0}
          onChange={(e) => onChange({ ...action, delay: { ...action.delay, value: Number(e.target.value) } })} />
        <select className={`${fieldClass} w-28`} value={action.delay?.unit || 'days'}
          onChange={(e) => onChange({ ...action, delay: { ...action.delay, unit: e.target.value } })}>
          {DELAY_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <span className="text-xs text-[var(--text-muted)]">(0 = immediately)</span>
      </div>
    </div>
  );
};

// ─── Builder ──────────────────────────────────────────────────────────────────
const AutomationBuilderPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { id } = useParams();
  const isEdit = !!id;

  const [meta, setMeta] = useState({ name: '', description: '' });
  const [trigger, setTrigger] = useState({ event: '', sourceModule: '' });
  const [conditions, setConditions] = useState([]);
  const [actions, setActions] = useState([{ ...emptyAction }]);
  const [isActive, setIsActive] = useState(false);

  const [catalog, setCatalog] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cat, camps] = await Promise.all([kitService.getTriggerCatalog(), kitService.getCampaigns()]);
      setCatalog(cat?.data?.triggers || []);
      setCampaigns(camps?.data || []);
      if (isEdit) {
        const res = await kitService.getWorkflow(id);
        const w = res.data;
        setMeta({ name: w.name, description: w.description || '' });
        setTrigger(w.trigger || { event: '', sourceModule: '' });
        setConditions(w.conditions || []);
        setActions(w.actions?.length ? w.actions.map((a) => ({ ...emptyAction, ...a, delay: a.delay || { value: 0, unit: 'days' }, params: a.params || {} })) : [{ ...emptyAction }]);
        setIsActive(w.isActive);
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to load');
      if (isEdit) navigate('/kit/automations');
    } finally {
      setLoading(false);
    }
  }, [id, isEdit, navigate, toast]);

  useEffect(() => { load(); }, [load]);

  const onTriggerChange = (event) => {
    const t = catalog.find((x) => x.event === event);
    setTrigger({ event, sourceModule: t?.sourceModule || '' });
  };

  // Strip each action down to the fields its type needs.
  const buildAction = (a) => {
    const base = { type: a.type, delay: a.delay };
    if (a.type === 'start_campaign' || a.type === 'stop_campaign') return { ...base, campaignId: a.campaignId };
    if (a.type === 'send_template') return { ...base, channel: a.channel, templateId: a.templateId };
    if (a.type === 'notify') return { ...base, params: { title: a.params?.title, message: a.params?.message } };
    return base;
  };

  const validate = () => {
    if (!meta.name.trim()) return 'Automation name is required';
    if (!trigger.event) return 'Select a trigger event';
    if (!actions.length) return 'Add at least one action';
    for (const a of actions) {
      if ((a.type === 'start_campaign' || a.type === 'stop_campaign') && !a.campaignId) return 'Select a campaign for the campaign action';
      if (a.type === 'send_template' && !a.templateId) return 'Select a template for the send action';
    }
    for (const c of conditions) {
      if (!c.field?.trim()) return 'Every condition needs a field';
    }
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) return toast.error(err);
    setSaving(true);
    try {
      const payload = {
        ...meta,
        trigger,
        conditions: conditions.filter((c) => c.field?.trim()),
        actions: actions.map(buildAction),
      };
      if (isEdit) {
        await kitService.updateWorkflow(id, payload);
        toast.success('Automation saved');
      } else {
        const res = await kitService.createWorkflow(payload);
        toast.success('Automation created');
        navigate(`/kit/automations/${res.data._id}`);
      }
    } catch (e) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    try {
      const res = await kitService.toggleWorkflow(id);
      setIsActive(res.data.isActive);
      toast.success(res.data.isActive ? 'Activated' : 'Paused');
    } catch (e) {
      toast.error(e?.message || 'Failed to toggle');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-[var(--text-muted)]">
        <Loader2 size={40} className="animate-spin mb-4 opacity-20" />
        <p className="text-sm font-bold uppercase tracking-widest">Loading automation...</p>
      </div>
    );
  }

  // Group catalog by module for the trigger dropdown.
  const grouped = catalog.reduce((acc, t) => { (acc[t.sourceModule] ||= []).push(t); return acc; }, {});

  return (
    <div className="max-w-[1000px] mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/kit/automations')} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Zap size={22} className="text-[var(--warning)]" />
            <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">{isEdit ? 'Edit Automation' : 'New Automation'}</h1>
          </div>
          {isEdit && (
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold ml-2 ${isActive ? 'text-[var(--success,#27AE60)]' : 'text-[var(--text-muted)]'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[var(--success,#27AE60)]' : 'bg-[var(--text-muted)]'}`} /> {isActive ? 'Active' : 'Paused'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEdit && (
            <Button variant="outline" onClick={toggleActive} className="px-4 py-2.5">
              {isActive ? <><Power size={16} /> Pause</> : <><Play size={16} /> Activate</>}
            </Button>
          )}
          <Button variant="primary" onClick={save} disabled={saving} className="px-5 py-2.5">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {isEdit ? 'Save' : 'Create'}
          </Button>
        </div>
      </div>

      {/* Meta */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 space-y-4">
        <div>
          <label className={labelClass}>Automation Name</label>
          <input className={fieldClass} value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} placeholder="e.g. Welcome new leads" />
        </div>
        <div>
          <label className={labelClass}>Description</label>
          <input className={fieldClass} value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} placeholder="Optional" />
        </div>
      </div>

      {/* WHEN */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3"><Zap size={16} className="text-[var(--warning)]" /><h3 className="font-black text-sm uppercase tracking-wider text-[var(--text-primary)]">When</h3></div>
        <select className={fieldClass} value={trigger.event} onChange={(e) => onTriggerChange(e.target.value)}>
          <option value="">Select a trigger event</option>
          {Object.entries(grouped).map(([mod, items]) => (
            <optgroup key={mod} label={mod.toUpperCase()}>
              {items.map((t) => <option key={t.event} value={t.event}>{t.label}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      {/* IF */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Filter size={16} className="text-[var(--primary)]" /><h3 className="font-black text-sm uppercase tracking-wider text-[var(--text-primary)]">If (optional)</h3></div>
          <Button variant="ghost" onClick={() => setConditions([...conditions, { ...emptyCondition }])} className="px-3 py-1.5 text-xs"><Plus size={14} /> Condition</Button>
        </div>
        {conditions.length === 0 && <p className="text-xs text-[var(--text-muted)]">No conditions — the actions run every time the trigger fires.</p>}
        {conditions.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <input className={fieldClass} placeholder="field (e.g. proposal_status, city)" value={c.field}
              onChange={(e) => setConditions(conditions.map((x, j) => j === i ? { ...x, field: e.target.value } : x))} />
            <select className={`${fieldClass} w-44`} value={c.operator}
              onChange={(e) => setConditions(conditions.map((x, j) => j === i ? { ...x, operator: e.target.value } : x))}>
              {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input className={fieldClass} placeholder="value" value={c.value ?? ''}
              onChange={(e) => setConditions(conditions.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} />
            <button onClick={() => setConditions(conditions.filter((_, j) => j !== i))} className="p-2 text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 rounded-lg shrink-0"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>

      {/* THEN */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Play size={16} className="text-[var(--success,#27AE60)]" /><h3 className="font-black text-sm uppercase tracking-wider text-[var(--text-primary)]">Then</h3></div>
          <Button variant="ghost" onClick={() => setActions([...actions, { ...emptyAction }])} className="px-3 py-1.5 text-xs"><Plus size={14} /> Action</Button>
        </div>
        {actions.map((a, i) => (
          <ActionRow key={i} action={a} campaigns={campaigns}
            onChange={(next) => setActions(actions.map((x, j) => j === i ? next : x))}
            onRemove={() => setActions(actions.filter((_, j) => j !== i))} />
        ))}
        {actions.length === 0 && <p className="text-xs text-[var(--error)]">Add at least one action.</p>}
      </div>
    </div>
  );
};

export default AutomationBuilderPage;
