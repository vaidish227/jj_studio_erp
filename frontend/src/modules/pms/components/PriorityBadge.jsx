import React from 'react';

const CONFIGS = {
  low:    { color: 'bg-[var(--border)] text-[var(--text-muted)] border-[var(--border)]',                 label: 'Low' },
  medium: { color: 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border-[var(--accent-blue)]/20', label: 'Medium' },
  high:   { color: 'bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/20',             label: 'High' },
  urgent: { color: 'bg-[var(--error)]/10 text-[var(--error)] border-[var(--error)]/20',                   label: 'Urgent' },
};

const PriorityBadge = ({ priority, className = '' }) => {
  const cfg = CONFIGS[priority] || CONFIGS.medium;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${cfg.color} ${className}`}>
      {cfg.label}
    </span>
  );
};

export default PriorityBadge;
