import React from 'react';

const StatusBadge = ({ status, className = '' }) => {
  const configs = {
    draft: {
      color: 'bg-[var(--bg)] text-[var(--text-muted)] border-[var(--border)]',
      label: 'Draft'
    },
    pending_approval: {
      color: 'bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/20',
      label: 'Pending Approval'
    },
    manager_approved: {
      color: 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20',
      label: 'Approved'
    },
    rejected: {
      color: 'bg-[var(--error)]/10 text-[var(--error)] border-[var(--error)]/20',
      label: 'Rejected'
    },
    sent: {
      color: 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border-[var(--accent-blue)]/20',
      label: 'Sent to Client'
    },
    esign_received: {
      color: 'bg-[var(--accent-teal)]/10 text-[var(--accent-teal)] border-[var(--accent-teal)]/20',
      label: 'eSign Received'
    },
    payment_received: {
      color: 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20',
      label: 'Paid'
    },
    project_ready: {
      color: 'bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20',
      label: 'Project Ready'
    },
    project_started: {
      color: 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20',
      label: 'Started'
    },
    converted: {
      color: 'bg-[var(--accent-teal)]/10 text-[var(--accent-teal)] border-[var(--accent-teal)]/20',
      label: 'Converted'
    },
  };

  const config = configs[status] || configs.draft;

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${config.color} ${className}`}>
      {config.label}
    </span>
  );
};

export default StatusBadge;
