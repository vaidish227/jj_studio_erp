import React from 'react';

const CONFIGS = {
  design_phase:     { color: 'bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20',                 label: 'Design Phase' },
  execution_phase:  { color: 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border-[var(--accent-blue)]/20',     label: 'Execution' },
  handover:         { color: 'bg-[var(--accent-teal)]/10 text-[var(--accent-teal)] border-[var(--accent-teal)]/20',     label: 'Handover' },
  completed:        { color: 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20',                 label: 'Completed' },
  on_hold:          { color: 'bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/20',                 label: 'On Hold' },
  cancelled:        { color: 'bg-[var(--error)]/10 text-[var(--error)] border-[var(--error)]/20',                       label: 'Cancelled' },
};

const ProjectStatusBadge = ({ status, className = '' }) => {
  const cfg = CONFIGS[status] || CONFIGS.design_phase;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${cfg.color} ${className}`}>
      {cfg.label}
    </span>
  );
};

export default ProjectStatusBadge;
