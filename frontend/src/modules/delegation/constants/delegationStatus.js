// Status + priority display metadata and the (UI-side) transition map.
// The transition map MIRRORS the backend ALLOWED_TRANSITIONS — the server is the
// authoritative enforcer; this only drives which action buttons are shown.

export const STATUS_META = {
  created:     { label: 'Created',     tone: 'muted' },
  assigned:    { label: 'Assigned',    tone: 'gold' },
  in_progress: { label: 'In Progress', tone: 'blue' },
  review:      { label: 'Review',      tone: 'warn' },
  completed:   { label: 'Completed',   tone: 'ok' },
  reopened:    { label: 'Reopened',    tone: 'err' },
  cancelled:   { label: 'Cancelled',   tone: 'muted' },
};

export const PRIORITY_META = {
  low:    { label: 'Low',    tone: 'muted' },
  medium: { label: 'Medium', tone: 'muted' },
  high:   { label: 'High',   tone: 'warn' },
  urgent: { label: 'Urgent', tone: 'err' },
};

export const STATUSES = Object.keys(STATUS_META);
export const PRIORITIES = Object.keys(PRIORITY_META);

export const ALLOWED_TRANSITIONS = {
  created:     ['assigned', 'in_progress', 'cancelled'],
  assigned:    ['in_progress', 'cancelled'],
  in_progress: ['review', 'cancelled'],
  review:      ['completed', 'in_progress', 'cancelled'],
  completed:   ['reopened'],
  reopened:    ['in_progress', 'cancelled'],
  cancelled:   [],
};

// Human label for a status transition action button.
export const TRANSITION_LABEL = {
  assigned: 'Mark Assigned',
  in_progress: 'Start',
  review: 'Send to Review',
  completed: 'Approve / Complete',
  reopened: 'Reopen',
  cancelled: 'Cancel',
};
