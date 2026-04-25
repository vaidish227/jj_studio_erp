import React from 'react';

const Button = ({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  className = '',
  isLoading = false,
  disabled = false,
  ...props
}) => {
  const base =
    'w-full flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed';

  const sizes = {
    sm: 'py-2 px-4 text-sm',
    md: 'py-3 px-6 text-sm',
    lg: 'py-4 px-8 text-base',
  };

  const variants = {
    primary:
      'bg-[var(--primary)] text-black hover:bg-[var(--primary-hover)] active:bg-[var(--primary-active)] focus:ring-[var(--primary)] shadow-sm hover:shadow-md hover:shadow-[var(--primary)]/25',
    outline:
      'bg-transparent border-2 border-[var(--primary)] text-[var(--text-secondary)] hover:bg-[var(--primary)]/5 focus:ring-[var(--primary)]',
    ghost:
      'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg)] focus:ring-[var(--border)]',
    danger:
      'bg-[var(--error)] text-white hover:opacity-90 focus:ring-[var(--error)]',
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={`${base} ${sizes[size] ?? sizes.md} ${variants[variant] ?? variants.primary} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>Loading...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;
