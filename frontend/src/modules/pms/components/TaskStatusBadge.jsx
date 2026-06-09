import React from 'react';

const CONFIGS = {
  not_started:             { color: 'bg-[var(--border)] text-[var(--text-muted)] border-[var(--border)]',                 label: 'Not Started' },
  blocked:                 { color: 'bg-[var(--error)]/10 text-[var(--error)] border-[var(--error)]/20',                  label: 'Blocked' },
  in_progress:             { color: 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border-[var(--accent-blue)]/20', label: 'In Progress' },
  pending_review:          { color: 'bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/20',             label: 'Pending Review' },
  revision_requested:      { color: 'bg-[var(--error)]/10 text-[var(--error)] border-[var(--error)]/20',                  label: 'Revision Needed' },
  pending_client_approval: { color: 'bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20',             label: 'Client Approval' },
  approved:                { color: 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20',             label: 'Approved' },
  released_to_site:        { color: 'bg-[var(--accent-teal)]/10 text-[var(--accent-teal)] border-[var(--accent-teal)]/20', label: 'Released' },
  completed:               { color: 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20',             label: 'Completed' },
  on_hold:                 { color: 'bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/20',             label: 'On Hold' },
};

const TaskStatusBadge = ({ status, className = '' }) => {
  const cfg = CONFIGS[status] || CONFIGS.not_started;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${cfg.color} ${className}`}>
      {cfg.label}
    </span>
  );
};

export default TaskStatusBadge;
