import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Save, Clock, Heart, MessageCircle, Mail, HelpCircle, Eye, Check, CheckCircle2 } from 'lucide-react';
import Button from '../../../shared/components/Button/Button';
import Modal from '../../../shared/components/Modal/Modal';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { kitService } from '../../../shared/services/kitService';

const fieldClass = 'w-full px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] transition-colors';
const areaClass  = `${fieldClass} resize-y leading-relaxed`;
const labelClass = 'block text-xs font-black uppercase tracking-wider text-[var(--text-muted)] mb-1.5';

// Backend email wrapper colour (mirror of emailLayout.js) so the preview matches the real email.
const EMAIL_BRAND = '#1f2937';

const Toggle = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-2.5 cursor-pointer">
    <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-[var(--primary)]" />
    <span className="text-sm font-bold text-[var(--text-secondary)]">{label}</span>
  </label>
);

// Sample data so the live preview always renders something realistic.
const SAMPLES = {
  lead_name: 'Asha Mehta', lead_phone: '+91 98765 43210', lead_email: 'asha@example.com',
  client_name: 'Asha Mehta', first_name: 'Asha', phone: '+91 98765 43210', email: 'asha@example.com',
  city: 'Bengaluru', project_type: 'Residential', enquiry_details: '3BHK full interior',
  referral_name: 'Rohan Gupta', referral_phone: '+91 99887 76655', referral_email: 'rohan@example.com',
  company_name: 'JJ Studio',
};
const renderSample = (t) =>
  String(t || '').replace(/\{\{(\w+)\}\}/g, (_, k) => (SAMPLES[k] !== undefined ? SAMPLES[k] : `{{${k}}}`));

// Friendly chip label → token. Shown next to each recipient's message boxes.
const LEAD_CHIPS = [
  { label: 'Customer name', token: '{{lead_name}}' },
  { label: 'Phone',         token: '{{lead_phone}}' },
  { label: 'Email',         token: '{{lead_email}}' },
  { label: 'City',          token: '{{city}}' },
  { label: 'Project type',  token: '{{project_type}}' },
  { label: 'Enquiry note',  token: '{{enquiry_details}}' },
  { label: 'Company',       token: '{{company_name}}' },
];
const REFERRAL_CHIPS = [
  { label: 'Referrer name',  token: '{{referral_name}}' },
  { label: 'Referrer phone', token: '{{referral_phone}}' },
  { label: 'Referrer email', token: '{{referral_email}}' },
  { label: 'Customer name',  token: '{{lead_name}}' },
  { label: 'Company',        token: '{{company_name}}' },
];

const DEFAULTS = {
  enabled: false,
  delayValue: 0,
  delayUnit: 'hours',
  channels: { whatsapp: true, email: true },
  recipients: { lead: true, referral: true },
  messages: {
    leadWhatsapp:     { body: '' },
    leadEmail:        { subject: '', body: '' },
    referralWhatsapp: { body: '' },
    referralEmail:    { subject: '', body: '' },
  },
};

const hydrate = (s = {}) => ({
  ...DEFAULTS, ...s,
  channels:   { ...DEFAULTS.channels,   ...(s.channels || {}) },
  recipients: { ...DEFAULTS.recipients, ...(s.recipients || {}) },
  messages: {
    leadWhatsapp:     { ...DEFAULTS.messages.leadWhatsapp,     ...(s.messages?.leadWhatsapp || {}) },
    leadEmail:        { ...DEFAULTS.messages.leadEmail,        ...(s.messages?.leadEmail || {}) },
    referralWhatsapp: { ...DEFAULTS.messages.referralWhatsapp, ...(s.messages?.referralWhatsapp || {}) },
    referralEmail:    { ...DEFAULTS.messages.referralEmail,    ...(s.messages?.referralEmail || {}) },
  },
});

// Module-level (stable identity) so typing never loses focus on re-render.
const MsgField = ({ label, icon: Icon, value, placeholder, rows = 3, singleLine = false, onChange, onFocus }) => (
  <div className="space-y-1.5">
    <label className={labelClass}>{Icon && <Icon size={12} className="inline mr-1 -mt-0.5" />}{label}</label>
    {singleLine ? (
      <input className={fieldClass} value={value} placeholder={placeholder}
        onFocus={(e) => onFocus(e.target)} onChange={(e) => onChange(e.target.value)} />
    ) : (
      <textarea className={areaClass} rows={rows} value={value} placeholder={placeholder}
        onFocus={(e) => onFocus(e.target)} onChange={(e) => onChange(e.target.value)} />
    )}
    <p className="text-xs text-[var(--text-muted)]"><span className="font-bold">Preview:</span> {renderSample(value) || '—'}</p>
  </div>
);

const Chips = ({ chips, onInsert }) => (
  <div className="flex flex-wrap gap-1.5">
    {chips.map((c) => (
      <button
        key={c.token + c.label}
        type="button"
        onMouseDown={(e) => e.preventDefault()}  // keep the textarea focused + caret position
        onClick={() => onInsert(c.token)}
        className="px-2.5 py-1 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-bold hover:bg-[var(--primary)]/20 transition-colors"
      >
        + {c.label}
      </button>
    ))}
  </div>
);

// "Load from template" — pick a saved Mail/WhatsApp template to FILL the box
// below (content is copied in and stays editable). Resets after each pick.
const TemplatePicker = ({ templates, onPick }) => {
  if (!templates?.length) return null;
  return (
    <select
      value=""
      onChange={(e) => { const t = templates.find((x) => x._id === e.target.value); if (t) onPick(t); e.target.value = ''; }}
      className="text-xs px-2.5 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text-secondary)] font-bold outline-none focus:border-[var(--primary)] max-w-[220px] cursor-pointer"
    >
      <option value="">↻ Load from saved template…</option>
      {templates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
    </select>
  );
};

// ── Realistic previews ────────────────────────────────────────────────────────
// WhatsApp chat-bubble preview (brand colours, not theme vars, for authenticity).
const WhatsAppPreview = ({ text }) => (
  <div className="rounded-2xl overflow-hidden border border-[var(--border)] shadow-sm">
    <div className="flex items-center gap-2.5 px-4 py-2.5" style={{ background: '#075E54' }}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-[#075E54]" style={{ background: '#ffffff' }}>JJ</div>
      <div className="leading-tight">
        <p className="text-sm font-bold text-white">JJ Studio</p>
        <p className="text-[10px] text-white/70">business account</p>
      </div>
    </div>
    <div className="px-3 py-4 min-h-[150px]" style={{ background: '#efeae2' }}>
      <div className="max-w-[88%] ml-auto rounded-lg rounded-tr-sm px-3 py-2 shadow-sm" style={{ background: '#d9fdd3' }}>
        <p className="text-sm whitespace-pre-wrap" style={{ color: '#111b21' }}>{text || '—'}</p>
        <p className="text-[10px] text-right mt-1 flex items-center justify-end gap-0.5" style={{ color: '#667781' }}>
          12:30 PM <Check size={12} style={{ color: '#53bdeb', marginLeft: '-4px' }} /><Check size={12} style={{ color: '#53bdeb', marginLeft: '-8px' }} />
        </p>
      </div>
    </div>
  </div>
);

// Branded email preview — mirrors backend emailLayout.js (header / body / footer).
const EmailPreview = ({ subject, body, company = 'JJ Studio' }) => {
  const year = new Date().getFullYear();
  return (
    <div className="rounded-2xl border border-[var(--border)] p-3 shadow-sm" style={{ background: '#f4f4f5' }}>
      <p className="text-xs mb-2 px-1" style={{ color: '#6b7280' }}><span className="font-bold">Subject:</span> {subject || '—'}</p>
      <div className="w-full rounded-xl overflow-hidden border" style={{ background: '#ffffff', borderColor: '#e5e7eb', fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <div className="px-6 py-4" style={{ background: EMAIL_BRAND }}>
          <span className="text-lg font-bold tracking-wide" style={{ color: '#ffffff' }}>{company}</span>
        </div>
        <div className="px-6 py-6 text-sm whitespace-pre-wrap" style={{ color: '#333333', lineHeight: 1.7 }}>{body || '—'}</div>
        <div className="px-6 py-3 text-xs" style={{ color: '#9ca3af', borderTop: '1px solid #eeeeee' }}>© {year} {company}. All rights reserved.</div>
      </div>
    </div>
  );
};

const ThankYouSettingsPage = () => {
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [waTemplates, setWaTemplates] = useState([]);
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewWho, setPreviewWho] = useState('lead'); // 'lead' | 'referral'
  const activeKeyRef = useRef(null); // { group, field }
  const activeElRef  = useRef(null); // DOM node of the last-focused message field

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, waRes, mailRes] = await Promise.all([
        kitService.getThankYouSettings(),
        kitService.getTemplates({ channel: 'whatsapp', isActive: true }),
        kitService.getTemplates({ channel: 'email', isActive: true }),
      ]);
      setSettings(hydrate(settingsRes?.settings));
      setWaTemplates(waRes?.data?.templates || []);
      setEmailTemplates(mailRes?.data?.templates || []);
    } catch (err) {
      toast.error(err?.message || 'Failed to load thank-you settings');
    } finally {
      setLoading(false);
    }
  }, [toast]);
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

  const patchMsg = (group, field, value) => {
    setSettings((prev) => ({
      ...prev,
      messages: { ...prev.messages, [group]: { ...prev.messages[group], [field]: value } },
    }));
  };

  // Fill a slot's fields from a saved template (copy — stays editable).
  const fillWhatsappFromTemplate = (group, t) => patchMsg(group, 'body', t.body || '');
  const fillEmailFromTemplate = (group, t) =>
    setSettings((prev) => ({
      ...prev,
      messages: { ...prev.messages, [group]: { ...prev.messages[group], subject: t.subject || '', body: t.htmlBody || '' } },
    }));

  const onFieldFocus = (group, field, el) => {
    activeKeyRef.current = { group, field };
    activeElRef.current = el;
  };

  const insertToken = (token) => {
    const k = activeKeyRef.current;
    const el = activeElRef.current;
    if (!k || !el) return; // nothing focused yet — chips do nothing until a box is clicked
    const cur = settings.messages[k.group][k.field] || '';
    const start = el.selectionStart ?? cur.length;
    const end   = el.selectionEnd ?? cur.length;
    const next = cur.slice(0, start) + token + cur.slice(end);
    patchMsg(k.group, k.field, next);
    requestAnimationFrame(() => {
      try { el.focus(); const p = start + token.length; el.setSelectionRange(p, p); } catch { /* ignore */ }
    });
  };

  const save = async () => {
    const n = Number(settings.delayValue);
    if (!Number.isFinite(n) || n < 0) { toast.error('“Send after” must be 0 or more'); return; }
    setSaving(true);
    try {
      const payload = {
        enabled: settings.enabled,
        delayValue: n,
        delayUnit: settings.delayUnit,
        channels: settings.channels,
        recipients: settings.recipients,
        messages: settings.messages,
      };
      const res = await kitService.updateThankYouSettings(payload);
      if (res?.settings) setSettings(hydrate(res.settings));
      toast.success('Thank-you settings saved');
    } catch (err) {
      toast.error(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-[900px] mx-auto p-8 flex items-center justify-center text-[var(--text-muted)]">
        <Loader2 size={24} className="animate-spin opacity-30" />
      </div>
    );
  }
  if (!settings) return null;

  const dimIf = (cond) => (cond ? '' : 'opacity-40 pointer-events-none');
  const m = settings.messages;

  // Green awareness line — states exactly when the thank-you will fire.
  const delayN = Number(settings.delayValue) || 0;
  const delayUnitLabel = delayN === 1 ? (settings.delayUnit || 'hours').replace(/s$/, '') : (settings.delayUnit || 'hours');
  const delayAwareness = delayN <= 0
    ? 'Thank-you messages will be sent immediately after the enquiry form is submitted.'
    : `Thank-you messages will be sent ${delayN} ${delayUnitLabel} after the enquiry form is submitted.`;

  // Preview data for the currently-selected recipient.
  const who = previewWho;
  const pvWa    = renderSample(who === 'lead' ? m.leadWhatsapp.body : m.referralWhatsapp.body);
  const pvSubj  = renderSample(who === 'lead' ? m.leadEmail.subject : m.referralEmail.subject);
  const pvBody  = renderSample(who === 'lead' ? m.leadEmail.body : m.referralEmail.body);
  const whoEnabled = who === 'lead' ? settings.recipients.lead : settings.recipients.referral;
  const tabCls = (active) => `px-3.5 py-1.5 rounded-lg text-sm font-bold transition-colors ${active ? 'bg-[var(--primary)] text-white' : 'bg-[var(--bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`;

  return (
    <div className="max-w-[900px] mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header with help + preview actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Thank You Automation</h1>
          <p className="text-[var(--text-muted)] font-medium max-w-[640px]">
            When an enquiry is submitted, automatically thank the customer and the person who referred them — over
            WhatsApp and Email. New here? Tap the <span className="text-[var(--primary)] font-bold">?</span> for a quick guide.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setHelpOpen(true)} title="How this works"
            className="w-9 h-9 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--primary)] hover:border-[var(--primary)] transition-colors">
            <HelpCircle size={18} />
          </button>
          <Button variant="outline" onClick={() => setPreviewOpen(true)} className="px-4 py-2">
            <Eye size={16} /> Preview
          </Button>
        </div>
      </div>

      {/* Automation + timing */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center"><Heart size={20} /></div>
            <h3 className="font-black text-lg text-[var(--text-primary)]">Automation</h3>
          </div>
          <Toggle checked={settings.enabled} onChange={(v) => patch('enabled', v)} label="Enabled" />
        </div>
        <div>
          <label className={labelClass}><Clock size={12} className="inline mr-1 -mt-0.5" /> Send after</label>
          <div className="flex gap-2 max-w-md">
            <input type="number" min={0} step={1} className={`${fieldClass} max-w-[150px]`} value={settings.delayValue}
              onChange={(e) => patch('delayValue', e.target.value === '' ? '' : Number(e.target.value))} />
            <select className={fieldClass} value={settings.delayUnit} onChange={(e) => patch('delayUnit', e.target.value)}>
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">0 = send immediately. For example: 30 Minutes, or 2 Hours.</p>
          <div className="mt-2.5 flex items-center gap-2 text-sm font-bold rounded-xl px-3 py-2"
            style={{ background: 'rgba(39, 174, 96, 0.12)', color: '#1f9d57' }}>
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{delayAwareness}</span>
          </div>
        </div>
      </div>

      {/* Channels + Recipients */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 space-y-4">
          <h4 className="font-black text-sm uppercase tracking-wider text-[var(--text-primary)]">Send over</h4>
          <Toggle checked={settings.channels.whatsapp} onChange={(v) => patch('channels.whatsapp', v)} label="WhatsApp" />
          <Toggle checked={settings.channels.email} onChange={(v) => patch('channels.email', v)} label="Email" />
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 space-y-4">
          <h4 className="font-black text-sm uppercase tracking-wider text-[var(--text-primary)]">Send to</h4>
          <Toggle checked={settings.recipients.lead} onChange={(v) => patch('recipients.lead', v)} label="Customer (the enquiry person)" />
          <Toggle checked={settings.recipients.referral} onChange={(v) => patch('recipients.referral', v)} label="Referral person" />
        </div>
      </div>

      {/* Message to the customer */}
      <div className={`bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 space-y-5 ${dimIf(settings.recipients.lead)}`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h4 className="font-black text-sm uppercase tracking-wider text-[var(--text-primary)]">Message to the customer</h4>
          <Chips chips={LEAD_CHIPS} onInsert={insertToken} />
        </div>
        <div className={`space-y-2 ${dimIf(settings.channels.whatsapp)}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)]">WhatsApp</span>
            <TemplatePicker templates={waTemplates} onPick={(t) => fillWhatsappFromTemplate('leadWhatsapp', t)} />
          </div>
          <MsgField label="WhatsApp message" icon={MessageCircle} value={m.leadWhatsapp.body}
            placeholder="Hi {{lead_name}}, thank you for your enquiry..."
            onChange={(v) => patchMsg('leadWhatsapp', 'body', v)} onFocus={(el) => onFieldFocus('leadWhatsapp', 'body', el)} />
        </div>
        <div className={`space-y-3 ${dimIf(settings.channels.email)}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)]">Email</span>
            <TemplatePicker templates={emailTemplates} onPick={(t) => fillEmailFromTemplate('leadEmail', t)} />
          </div>
          <MsgField label="Email subject" icon={Mail} singleLine value={m.leadEmail.subject}
            placeholder="Thank you for your enquiry, {{lead_name}}"
            onChange={(v) => patchMsg('leadEmail', 'subject', v)} onFocus={(el) => onFieldFocus('leadEmail', 'subject', el)} />
          <MsgField label="Email message" rows={5} value={m.leadEmail.body}
            placeholder="Hi {{lead_name}}, ..."
            onChange={(v) => patchMsg('leadEmail', 'body', v)} onFocus={(el) => onFieldFocus('leadEmail', 'body', el)} />
        </div>
      </div>

      {/* Message to the referral person */}
      <div className={`bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 space-y-5 ${dimIf(settings.recipients.referral)}`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h4 className="font-black text-sm uppercase tracking-wider text-[var(--text-primary)]">Message to the referral person</h4>
          <Chips chips={REFERRAL_CHIPS} onInsert={insertToken} />
        </div>
        <div className={`space-y-2 ${dimIf(settings.channels.whatsapp)}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)]">WhatsApp</span>
            <TemplatePicker templates={waTemplates} onPick={(t) => fillWhatsappFromTemplate('referralWhatsapp', t)} />
          </div>
          <MsgField label="WhatsApp message" icon={MessageCircle} value={m.referralWhatsapp.body}
            placeholder="Hi {{referral_name}}, thank you for referring {{lead_name}}..."
            onChange={(v) => patchMsg('referralWhatsapp', 'body', v)} onFocus={(el) => onFieldFocus('referralWhatsapp', 'body', el)} />
        </div>
        <div className={`space-y-3 ${dimIf(settings.channels.email)}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)]">Email</span>
            <TemplatePicker templates={emailTemplates} onPick={(t) => fillEmailFromTemplate('referralEmail', t)} />
          </div>
          <MsgField label="Email subject" icon={Mail} singleLine value={m.referralEmail.subject}
            placeholder="Thank you for your referral, {{referral_name}}"
            onChange={(v) => patchMsg('referralEmail', 'subject', v)} onFocus={(el) => onFieldFocus('referralEmail', 'subject', el)} />
          <MsgField label="Email message" rows={5} value={m.referralEmail.body}
            placeholder="Hi {{referral_name}}, ..."
            onChange={(v) => patchMsg('referralEmail', 'body', v)} onFocus={(el) => onFieldFocus('referralEmail', 'body', el)} />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => setPreviewOpen(true)} className="px-5 py-2.5"><Eye size={16} /> Preview</Button>
        <Button variant="primary" onClick={save} disabled={saving} className="px-5 py-2.5">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
        </Button>
      </div>

      {/* ── Help / guidance modal ───────────────────────────────────────────── */}
      <Modal isOpen={helpOpen} onClose={() => setHelpOpen(false)} title="How Thank You Automation works">
        <div className="space-y-4 text-sm text-[var(--text-secondary)]">
          <p>This sends an automatic thank-you the moment a new enquiry is submitted — to the customer and, when their details exist, the person who referred them.</p>
          <ol className="space-y-2.5 list-none">
            {[
              ['Turn it on', 'Flip the “Enabled” switch at the top. While it’s off, nothing is sent.'],
              ['Set the timing', '“Send after” — type a number and pick a unit (Minutes, Hours or Days). 0 sends immediately; e.g. 30 Minutes waits half an hour after the enquiry.'],
              ['Choose channels', '“Send over” — WhatsApp, Email, or both.'],
              ['Choose recipients', '“Send to” — the customer, the referral person, or both.'],
              ['Write the messages', 'Type in each box, click a + chip (e.g. “+ Customer name”) to drop in details, or “↻ Load from saved template”.'],
              ['Preview', 'Click “Preview” to see the real WhatsApp and email look before going live.'],
              ['Save', 'Click “Save”. Done!'],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="w-6 h-6 shrink-0 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-black flex items-center justify-center">{i + 1}</span>
                <span><b className="text-[var(--text-primary)]">{t}.</b> {d}</span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-[var(--text-muted)] bg-[var(--bg)] rounded-xl p-3 border border-[var(--border)]">
            Tip: placeholders like <code className="font-mono">{'{{lead_name}}'}</code> are filled automatically with each customer’s real details when the message is sent — your customers never see the code.
          </p>
        </div>
      </Modal>

      {/* ── Realistic preview modal ─────────────────────────────────────────── */}
      <Modal isOpen={previewOpen} onClose={() => setPreviewOpen(false)} title="Preview — how it will look" className="max-w-2xl">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button className={tabCls(who === 'lead')} onClick={() => setPreviewWho('lead')}>Customer</button>
            <button className={tabCls(who === 'referral')} onClick={() => setPreviewWho('referral')}>Referral person</button>
          </div>

          {!whoEnabled && (
            <p className="text-xs font-bold text-[var(--warning)] bg-[var(--warning)]/10 rounded-xl px-3 py-2 border border-[var(--warning)]/30">
              This recipient is currently turned off under “Send to”. Shown for preview only.
            </p>
          )}

          <p className="text-xs text-[var(--text-muted)]">Rendered with sample details (e.g. {who === 'lead' ? 'Asha Mehta' : 'Rohan Gupta'}).</p>

          <div className="space-y-5">
            {settings.channels.whatsapp && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5"><MessageCircle size={12} /> WhatsApp</p>
                <WhatsAppPreview text={pvWa} />
              </div>
            )}
            {settings.channels.email && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5"><Mail size={12} /> Email</p>
                <EmailPreview subject={pvSubj} body={pvBody} />
              </div>
            )}
            {!settings.channels.whatsapp && !settings.channels.email && (
              <p className="text-sm text-[var(--text-muted)] text-center py-6">Both channels are turned off under “Send over”.</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ThankYouSettingsPage;
