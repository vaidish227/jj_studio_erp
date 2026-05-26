import React from 'react';

const CONFIGS = {
  draft:              { color: 'bg-[var(--bg)] text-[var(--text-muted)] border-[var(--border)]',                           label: 'Draft' },
  sent_for_approval:  { color: 'bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20',                 label: 'Pending Approval' },
  approved:           { color: 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20',                 label: 'Approved' },
  rejected:           { color: 'bg-[var(--error)]/10 text-[var(--error)] border-[var(--error)]/20',                       label: 'Rejected' },
  released_to_site:   { color: 'bg-[var(--accent-teal)]/10 text-[var(--accent-teal)] border-[var(--accent-teal)]/20',     label: 'Released to Site' },
};

const DrawingStatusBadge = ({ status, className = '' }) => {
  const cfg = CONFIGS[status] || CONFIGS.draft;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${cfg.color} ${className}`}>
      {cfg.label}
    </span>
  );
};

export default DrawingStatusBadge;
