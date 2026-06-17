import React from 'react';

// Shared visual tokens so every map stays consistent.
const TONE = {
  muted:   'bg-[var(--bg)] text-[var(--text-muted)] border-[var(--border)]',
  warning: 'bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/20',
  success: 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20',
  error:   'bg-[var(--error)]/10 text-[var(--error)] border-[var(--error)]/20',
  blue:    'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border-[var(--accent-blue)]/20',
  teal:    'bg-[var(--accent-teal)]/10 text-[var(--accent-teal)] border-[var(--accent-teal)]/20',
  primary: 'bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20',
};

// Proposal lifecycle (the original map — used by proposal/PMS pages).
const PROPOSAL = {
  draft:            { color: TONE.muted,   label: 'Draft' },
  pending_approval: { color: TONE.warning, label: 'Pending Approval' },
  manager_approved: { color: TONE.success, label: 'Approved' },
  rejected:         { color: TONE.error,   label: 'Rejected' },
  sent:             { color: TONE.blue,    label: 'Sent to Client' },
  esign_received:   { color: TONE.teal,    label: 'eSign Received' },
  payment_received: { color: TONE.success, label: 'Paid' },
  project_ready:    { color: TONE.primary, label: 'Project Ready' },
  project_started:  { color: TONE.success, label: 'Started' },
  converted:        { color: TONE.teal,    label: 'Converted' },
};

// CRM lead status.
const LEAD_STATUS = {
  new:          { color: TONE.blue,    label: 'New' },
  contacted:    { color: TONE.warning, label: 'In Progress' },
  meeting_done: { color: TONE.warning, label: 'Meeting Done' },
  proposal_sent:{ color: TONE.primary, label: 'Proposal Sent' },
  converted:    { color: TONE.success, label: 'Converted' },
  lost:         { color: TONE.error,   label: 'Lost' },
};

// CRM lifecycle stages (type="lifecycle").
const LIFECYCLE = {
  enquiry:              { color: TONE.muted,   label: 'Enquiry' },
  client_info_pending: { color: TONE.warning, label: 'Client Info Pending' },
  meeting_scheduled:   { color: TONE.blue,    label: 'Meeting Scheduled' },
  thank_you_sent:      { color: TONE.blue,    label: 'Thank You Sent' },
  kit:                 { color: TONE.blue,    label: 'KIT' },
  followup_due:        { color: TONE.warning, label: 'Follow-up Due' },
  show_project:        { color: TONE.primary, label: 'Show Project' },
  interested:          { color: TONE.teal,    label: 'Interested' },
  proposal_sent:       { color: TONE.primary, label: 'Proposal Sent' },
  advance_received:    { color: TONE.success, label: 'Advance Received' },
  project_moved:       { color: TONE.success, label: 'Moved to Project' },
  project_started:     { color: TONE.success, label: 'Project Started' },
  converted:           { color: TONE.success, label: 'Converted' },
  lost:                { color: TONE.error,   label: 'Lost' },
};

// Priority (type="priority").
const PRIORITY = {
  high:   { color: TONE.error,   label: 'High' },
  medium: { color: TONE.warning, label: 'Medium' },
  low:    { color: TONE.success, label: 'Low' },
};

const MAPS = {
  default:   PROPOSAL,
  proposal:  PROPOSAL,
  status:    LEAD_STATUS,
  lifecycle: LIFECYCLE,
  priority:  PRIORITY,
};

// Turn an unknown key into a readable label instead of silently showing "Draft".
const humanize = (raw) =>
  String(raw)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

// Accepts either `status` (proposal/PMS callers) or `value` (CRM/lead callers).
// `type` selects which config map to use: 'lifecycle' | 'priority' | 'status' | 'proposal'.
const StatusBadge = ({ status, value, type = 'default', className = '' }) => {
  const key = (status ?? value ?? '').toString();
  const map = MAPS[type] || MAPS.default;
  // Lead statuses also flow through with type="default" (e.g. LeadCard), so fall
  // back to the lead-status map before giving up on a known key.
  const config =
    map[key] ||
    LEAD_STATUS[key] ||
    (key
      ? { color: TONE.muted, label: humanize(key) }
      : { color: TONE.muted, label: 'Unknown' });

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${config.color} ${className}`}>
      {config.label}
    </span>
  );
};

export default StatusBadge;
