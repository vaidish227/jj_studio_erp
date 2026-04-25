import React from 'react';

/**
 * Badge — small status label.
 * Props: label, variant (overdue|today|tomorrow|success|warning|error|info|default)
 */
const variants = {
  overdue:   'bg-[var(--error)]/10   text-[var(--error)]   border border-[var(--error)]/20',
  today:     'bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/20',
  tomorrow:  'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/20',
  success:   'bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20',
  warning:   'bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/20',
  error:     'bg-[var(--error)]/10   text-[var(--error)]   border border-[var(--error)]/20',
  default:   'bg-[var(--bg)]         text-[var(--text-muted)] border border-[var(--border)]',
};

const Badge = ({ label, variant = 'default', className = '' }) => {
  const style = variants[variant] ?? variants.default;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold tracking-wide uppercase ${style} ${className}`}>
      {label}
    </span>
  );
};

export default Badge;
