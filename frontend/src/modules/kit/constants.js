// Shared front-end constants for the KIT module (mirror backend enums).
import { MessageCircle, Mail, Bell } from 'lucide-react';

export const CHANNELS = {
  whatsapp:     { key: 'whatsapp',     label: 'WhatsApp',     icon: MessageCircle, accent: 'var(--accent-blue)' },
  email:        { key: 'email',        label: 'Email',        icon: Mail,          accent: 'var(--primary)' },
  notification: { key: 'notification', label: 'Notification', icon: Bell,          accent: 'var(--warning)' },
};

export const CATEGORIES = [
  'welcome', 'meeting', 'proposal', 'followup', 'reminder',
  'approval', 'marketing', 'system', 'custom',
];

export const MEDIA_TYPES = ['none', 'image', 'document', 'video'];

export const DELAY_UNITS = ['minutes', 'hours', 'days'];

export const AUDIENCES = ['leads', 'prospects', 'clients', 'projects', 'past_clients'];

// Maps a campaign audience to the entity type used for enrollment + resolution.
export const AUDIENCE_ENTITY = {
  leads: 'lead', prospects: 'lead', clients: 'client',
  projects: 'project', past_clients: 'client',
};

export const CAMPAIGN_STATUS_META = {
  draft:    { label: 'Draft',    color: 'var(--text-muted)' },
  active:   { label: 'Active',   color: 'var(--success, #27AE60)' },
  paused:   { label: 'Paused',   color: 'var(--warning)' },
  archived: { label: 'Archived', color: 'var(--text-muted)' },
};

// Workflow (automation) — IF condition operators.
export const OPERATORS = [
  { value: 'eq',       label: 'equals' },
  { value: 'ne',       label: 'not equals' },
  { value: 'gt',       label: 'greater than' },
  { value: 'gte',      label: '≥' },
  { value: 'lt',       label: 'less than' },
  { value: 'lte',      label: '≤' },
  { value: 'in',       label: 'in (comma list)' },
  { value: 'nin',      label: 'not in (comma list)' },
  { value: 'contains', label: 'contains' },
  { value: 'exists',   label: 'exists' },
];

// Workflow THEN action types.
export const ACTION_TYPES = [
  { value: 'start_campaign', label: 'Start Campaign' },
  { value: 'stop_campaign',  label: 'Stop Campaign' },
  { value: 'send_template',  label: 'Send Template' },
  { value: 'notify',         label: 'Notify Team' },
];
