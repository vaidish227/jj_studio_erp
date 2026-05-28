import React, { useEffect, useState } from 'react';
import { Mail, MessageSquare, Phone, Plus, User, UserPlus, X } from 'lucide-react';
import MultiEmployeePicker from '../MultiEmployeePicker/MultiEmployeePicker';

const RELATION_OPTIONS = [
  { value: 'spouse',         label: 'Spouse' },
  { value: 'parent',         label: 'Parent' },
  { value: 'partner',        label: 'Business partner' },
  { value: 'decision_maker', label: 'Decision maker' },
  { value: 'other',          label: 'Other' },
];

const NotifyToggle = ({ enabled, onToggle, icon: Icon, label }) => (
  <button
    type="button"
    onClick={onToggle}
    title={`${enabled ? 'Disable' : 'Enable'} ${label} notifications`}
    className={`p-1.5 rounded-md border transition-colors ${
      enabled
        ? 'bg-[var(--primary)]/10 border-[var(--primary)]/30 text-[var(--primary)]'
        : 'bg-[var(--bg)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
    }`}
  >
    <Icon size={13} />
  </button>
);

const SectionLabel = ({ icon: Icon, title, hint }) => (
  <div className="flex items-baseline justify-between">
    <div className="flex items-center gap-2">
      <Icon size={14} className="text-[var(--text-muted)]" />
      <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">{title}</p>
    </div>
    {hint && <span className="text-[10px] text-[var(--text-muted)]">{hint}</span>}
  </div>
);

const internalFromUser = (u) => ({
  userId: u._id,
  name: u.name || '',
  email: u.email || '',
  phone: u.phone || '',
  role: u.role || '',
  notifyEmail: true,
  notifyWhatsApp: true,
});

const InternalChip = ({ attendee, onToggleChannel, onRemove }) => (
  <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
    <div className="w-6 h-6 rounded-full bg-[var(--primary)]/10 flex items-center justify-center font-black text-[9px] text-[var(--primary)] shrink-0">
      {(attendee.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{attendee.name || 'Unnamed'}</p>
      <p className="text-[10px] text-[var(--text-muted)] truncate">{attendee.email || attendee.phone || (attendee.role || '—')}</p>
    </div>
    <div className="flex items-center gap-1 shrink-0">
      <NotifyToggle
        enabled={attendee.notifyEmail}
        onToggle={() => onToggleChannel('notifyEmail')}
        icon={Mail}
        label="email"
      />
      <NotifyToggle
        enabled={attendee.notifyWhatsApp}
        onToggle={() => onToggleChannel('notifyWhatsApp')}
        icon={MessageSquare}
        label="WhatsApp"
      />
      <button
        type="button"
        onClick={onRemove}
        title="Remove"
        className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--error)]"
      >
        <X size={13} />
      </button>
    </div>
  </div>
);

const ClientRow = ({ attendee, onToggleChannel, onRemove, locked }) => (
  <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
    <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center font-black text-[9px] text-amber-700 shrink-0">
      {(attendee.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
        {attendee.name}
        {attendee.relation && (
          <span className="ml-1.5 text-[9px] uppercase font-black tracking-widest text-[var(--text-muted)]">
            {attendee.relation === 'lead' ? 'Lead' : RELATION_OPTIONS.find((r) => r.value === attendee.relation)?.label || attendee.relation}
          </span>
        )}
      </p>
      <p className="text-[10px] text-[var(--text-muted)] truncate">
        {attendee.email || attendee.phone || '—'}
      </p>
    </div>
    <div className="flex items-center gap-1 shrink-0">
      <NotifyToggle
        enabled={attendee.notifyEmail}
        onToggle={() => onToggleChannel('notifyEmail')}
        icon={Mail}
        label="email"
      />
      <NotifyToggle
        enabled={attendee.notifyWhatsApp}
        onToggle={() => onToggleChannel('notifyWhatsApp')}
        icon={MessageSquare}
        label="WhatsApp"
      />
      {!locked && (
        <button
          type="button"
          onClick={onRemove}
          title="Remove"
          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--error)]"
        >
          <X size={13} />
        </button>
      )}
    </div>
  </div>
);

const AddParticipantRow = ({ onAdd, onCancel }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [relation, setRelation] = useState('other');

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd({
      name: trimmed,
      phone: phone.trim(),
      email: email.trim(),
      relation,
      notifyEmail: true,
      notifyWhatsApp: true,
    });
    setName('');
    setPhone('');
    setEmail('');
    setRelation('other');
  };

  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] p-3 space-y-2 bg-[var(--bg)]">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name *"
          className="px-2.5 py-2 text-xs rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
        />
        <select
          value={relation}
          onChange={(e) => setRelation(e.target.value)}
          className="px-2.5 py-2 text-xs rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
        >
          {RELATION_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone (for WhatsApp)"
          className="px-2.5 py-2 text-xs rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="px-2.5 py-2 text-xs rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
        />
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-md text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!name.trim()}
          className="px-3 py-1.5 rounded-md text-xs font-black uppercase tracking-wider bg-[var(--primary)] text-black disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>
    </div>
  );
};

/**
 * AttendeesEditor — manages internal staff + client-side attendees for a meeting.
 *
 * Props:
 *   lead       — { name, phone, email, spouse?: { name, phone, email } } | null
 *   value      — { internal: InternalAttendee[], client: ClientAttendee[] }
 *   onChange   — (next) => void
 *   filterRoles — optional roles allowlist for the internal picker
 *
 * The lead (if provided) is auto-included in `value.client` as a non-removable
 * row with relation: 'lead' on first render — callers should also seed it when
 * initialising state, but this component will repair a missing lead row.
 */
const AttendeesEditor = ({ lead, value, onChange, filterRoles }) => {
  const internal = Array.isArray(value?.internal) ? value.internal : [];
  const client = Array.isArray(value?.client) ? value.client : [];
  const [showAddRow, setShowAddRow] = useState(false);

  // Ensure the lead is always present as a client attendee (relation: 'lead')
  useEffect(() => {
    if (!lead?.name) return;
    const hasLead = client.some((c) => c.relation === 'lead');
    if (hasLead) return;
    onChange({
      internal,
      client: [
        {
          name: lead.name,
          phone: lead.phone || '',
          email: lead.email || '',
          relation: 'lead',
          notifyEmail: true,
          notifyWhatsApp: true,
        },
        ...client,
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.name]);

  const spouseAlreadyAdded = client.some(
    (c) => c.relation === 'spouse' && (c.name || '').toLowerCase() === (lead?.spouse?.name || '').toLowerCase()
  );
  const canSuggestSpouse = Boolean(lead?.spouse?.name) && !spouseAlreadyAdded;

  // ─── Internal helpers ──────────────────────────────────────────────
  const setInternalUsers = (users) => {
    // Build a fresh internal list preserving toggle state for already-selected users
    const existingById = new Map(internal.map((a) => [String(a.userId), a]));
    const nextInternal = users.map((u) => {
      const existing = existingById.get(String(u._id));
      if (existing) return { ...existing, name: u.name, email: u.email, phone: u.phone || existing.phone, role: u.role };
      return internalFromUser(u);
    });
    onChange({ internal: nextInternal, client });
  };

  const toggleInternalChannel = (idx, channel) => {
    const next = internal.map((a, i) => (i === idx ? { ...a, [channel]: !a[channel] } : a));
    onChange({ internal: next, client });
  };

  const removeInternal = (idx) => {
    onChange({ internal: internal.filter((_, i) => i !== idx), client });
  };

  // ─── Client helpers ────────────────────────────────────────────────
  const addClient = (entry) => {
    onChange({ internal, client: [...client, entry] });
    setShowAddRow(false);
  };

  const toggleClientChannel = (idx, channel) => {
    const next = client.map((a, i) => (i === idx ? { ...a, [channel]: !a[channel] } : a));
    onChange({ internal, client: next });
  };

  const removeClient = (idx) => {
    onChange({ internal, client: client.filter((_, i) => i !== idx) });
  };

  const addSpouseSuggestion = () => {
    addClient({
      name: lead.spouse.name,
      phone: lead.spouse.phone || '',
      email: lead.spouse.email || '',
      relation: 'spouse',
      notifyEmail: true,
      notifyWhatsApp: true,
    });
  };

  // The currently-selected User objects for the picker
  const pickerValue = internal.map((a) => ({
    _id: a.userId,
    name: a.name,
    email: a.email,
    phone: a.phone,
    role: a.role,
  }));

  return (
    <div className="space-y-5">
      {/* Internal team */}
      <div className="space-y-2">
        <SectionLabel
          icon={User}
          title="Internal Team"
          hint={internal.length ? `${internal.length} added` : 'Optional — adds staff to notify'}
        />
        <MultiEmployeePicker
          value={pickerValue}
          onChange={setInternalUsers}
          filterRoles={filterRoles}
          placeholder="Add team members..."
        />
        {internal.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {internal.map((a, idx) => (
              <InternalChip
                key={`${a.userId}-${idx}`}
                attendee={a}
                onToggleChannel={(ch) => toggleInternalChannel(idx, ch)}
                onRemove={() => removeInternal(idx)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Client side */}
      <div className="space-y-2">
        <SectionLabel
          icon={UserPlus}
          title="Client Side"
          hint={client.length ? `${client.length} added` : 'Lead is auto-included'}
        />

        <div className="space-y-2">
          {client.map((c, idx) => (
            <ClientRow
              key={`${c.name}-${idx}`}
              attendee={c}
              onToggleChannel={(ch) => toggleClientChannel(idx, ch)}
              onRemove={() => removeClient(idx)}
              locked={c.relation === 'lead'}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {canSuggestSpouse && (
            <button
              type="button"
              onClick={addSpouseSuggestion}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold border border-dashed border-[var(--primary)]/40 text-[var(--primary)] hover:bg-[var(--primary)]/5"
            >
              <Plus size={12} />
              Add spouse — {lead.spouse.name}
            </button>
          )}
          {!showAddRow && (
            <button
              type="button"
              onClick={() => setShowAddRow(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold border border-dashed border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)]"
            >
              <Plus size={12} />
              Add Participant
            </button>
          )}
        </div>

        {showAddRow && (
          <AddParticipantRow
            onAdd={addClient}
            onCancel={() => setShowAddRow(false)}
          />
        )}
      </div>

      <p className="text-[10px] text-[var(--text-muted)] flex items-center gap-1.5 pt-1">
        <Phone size={10} />
        Toggles control which channels each attendee gets notified on. Notifications are sent automatically when meeting reminders go out.
      </p>
    </div>
  );
};

export default AttendeesEditor;
