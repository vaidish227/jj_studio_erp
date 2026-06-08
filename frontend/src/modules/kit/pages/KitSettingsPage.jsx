import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Save, Clock, Gauge, MessageCircle, Mail } from 'lucide-react';
import Button from '../../../shared/components/Button/Button';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { kitService } from '../../../shared/services/kitService';

const fieldClass = 'w-full px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] transition-colors';
const labelClass = 'block text-xs font-black uppercase tracking-wider text-[var(--text-muted)] mb-1.5';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const fmtHour = (h) => `${String(h).padStart(2, '0')}:00`;

const Toggle = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-2.5 cursor-pointer">
    <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-[var(--primary)]" />
    <span className="text-sm font-bold text-[var(--text-secondary)]">{label}</span>
  </label>
);

const ChannelCard = ({ channel, icon: Icon, label }) => {
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await kitService.getCommSettings(channel);
      setSettings(res.data);
    } catch (err) {
      toast.error(err?.message || `Failed to load ${label} settings`);
    } finally {
      setLoading(false);
    }
  }, [channel, label, toast]);

  useEffect(() => { load(); }, [load]);

  const patch = (path, value) => {
    setSettings((prev) => {
      const next = { ...prev };
      const [group, key] = path.split('.');
      if (key) next[group] = { ...next[group], [key]: value };
      else next[group] = value;
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      // Carry activeProvider through so a first-time upsert passes validation.
      const payload = {
        isActive: settings.isActive,
        activeProvider: settings.activeProvider,
        scheduling: settings.scheduling,
        rateLimit: settings.rateLimit,
      };
      await kitService.updateCommSettings(channel, payload);
      toast.success(`${label} settings saved`);
    } catch (err) {
      toast.error(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 flex items-center justify-center text-[var(--text-muted)]">
        <Loader2 size={24} className="animate-spin opacity-30" />
      </div>
    );
  }
  if (!settings) return null;

  const sch = settings.scheduling || {};
  const rl = settings.rateLimit || {};

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center"><Icon size={20} /></div>
          <h3 className="font-black text-lg text-[var(--text-primary)]">{label}</h3>
        </div>
        <Toggle checked={settings.isActive} onChange={(v) => patch('isActive', v)} label="Channel enabled" />
      </div>

      {/* Quiet-hours window */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-[var(--text-primary)]">
          <Clock size={16} /><h4 className="font-black text-sm uppercase tracking-wider">Sending Window (IST)</h4>
        </div>
        <Toggle checked={sch.enabled} onChange={(v) => patch('scheduling.enabled', v)} label="Restrict to a daily window" />
        <div className={`grid grid-cols-2 gap-3 ${sch.enabled ? '' : 'opacity-40 pointer-events-none'}`}>
          <div>
            <label className={labelClass}>From</label>
            <select className={fieldClass} value={sch.allowedHoursStart ?? 8} onChange={(e) => patch('scheduling.allowedHoursStart', Number(e.target.value))}>
              {HOURS.map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>To</label>
            <select className={fieldClass} value={sch.allowedHoursEnd ?? 20} onChange={(e) => patch('scheduling.allowedHoursEnd', Number(e.target.value))}>
              {HOURS.map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
            </select>
          </div>
        </div>
        <div className={sch.enabled ? '' : 'opacity-40 pointer-events-none'}>
          <Toggle checked={sch.weekendsAllowed} onChange={(v) => patch('scheduling.weekendsAllowed', v)} label="Allow weekends" />
        </div>
      </div>

      {/* Rate limit */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-[var(--text-primary)]">
          <Gauge size={16} /><h4 className="font-black text-sm uppercase tracking-wider">Rate Limit</h4>
        </div>
        <Toggle checked={rl.enabled} onChange={(v) => patch('rateLimit.enabled', v)} label="Throttle sending rate" />
        <div className={`grid grid-cols-2 gap-3 ${rl.enabled ? '' : 'opacity-40 pointer-events-none'}`}>
          <div>
            <label className={labelClass}>Max / hour</label>
            <input type="number" min={1} className={fieldClass} value={rl.maxPerHour ?? 100} onChange={(e) => patch('rateLimit.maxPerHour', Number(e.target.value))} />
          </div>
          <div>
            <label className={labelClass}>Max / day</label>
            <input type="number" min={1} className={fieldClass} value={rl.maxPerDay ?? 500} onChange={(e) => patch('rateLimit.maxPerDay', Number(e.target.value))} />
          </div>
        </div>
        <p className="text-xs text-[var(--text-muted)]">Rolling windows: last 60 minutes / last 24 hours.</p>
      </div>

      <div className="flex justify-end">
        <Button variant="primary" onClick={save} disabled={saving} className="px-5 py-2.5">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save {label}
        </Button>
      </div>
    </div>
  );
};

const KitSettingsPage = () => (
  <div className="max-w-[1100px] mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
    <div className="space-y-1">
      <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Delivery Settings</h1>
      <p className="text-[var(--text-muted)] font-medium">
        Quiet-hours and rate limits apply to all KIT sends (campaigns, automations) and every other queued message.
      </p>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ChannelCard channel="whatsapp" icon={MessageCircle} label="WhatsApp" />
      <ChannelCard channel="mail" icon={Mail} label="Email" />
    </div>
  </div>
);

export default KitSettingsPage;
