import React from 'react';

const MenuItem = ({ icon: Icon, label, onClick, variant = 'default', className = '' }) => {
  const variantClasses = {
    default: 'text-[var(--text-primary)] hover:bg-[var(--bg)]',
    danger: 'text-[var(--error)] hover:bg-[var(--error)]/5',
  };

  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium
        transition-colors duration-150
        ${variantClasses[variant] || variantClasses.default}
        ${className}
      `}
    >
      {Icon && <Icon size={18} className={variant === 'danger' ? 'text-[var(--error)]' : 'text-[var(--text-muted)]'} />}
      <span>{label}</span>
    </button>
  );
};

export default MenuItem;
