import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const Input = ({
  label,
  icon: Icon,
  type = 'text',
  error,
  className = '',
  min,
  required = false,
  onKeyDown,
  onChange,
  onWheel,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  // Number fields default to non-negative. A consumer can still opt into
  // negatives by explicitly passing a negative `min`.
  const isNumber = type === 'number';
  const resolvedMin = isNumber && min === undefined ? 0 : min;
  const blockNegative = isNumber && resolvedMin != null && Number(resolvedMin) >= 0;

  const handleKeyDown = (e) => {
    // Stop typing a sign / exponent that would produce a negative or invalid number.
    if (blockNegative && ['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault();
    onKeyDown?.(e);
  };

  const handleChange = (e) => {
    // Strip any negative sign that slips in via paste / autofill before it bubbles up.
    if (blockNegative && e.target.value.includes('-')) {
      e.target.value = e.target.value.replace(/-/g, '');
    }
    onChange?.(e);
  };

  // Prevent the scroll wheel from silently changing a focused number field.
  const handleWheel = (e) => {
    if (isNumber) e.currentTarget.blur();
    onWheel?.(e);
  };

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="text-sm font-medium text-[var(--text-secondary)] ml-1">
          {label}
          {required && <span className="text-[var(--error)] ml-0.5">*</span>}
        </label>
      )}
      <div className="relative group">
        {Icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--primary)] transition-colors">
            <Icon size={20} />
          </div>
        )}
        
        <input
          type={inputType}
          min={resolvedMin}
          required={required}
          onKeyDown={handleKeyDown}
          onChange={handleChange}
          onWheel={handleWheel}
          className={`
            w-full bg-[var(--surface)] border border-[var(--border)]
            rounded-xl py-3 pr-4 transition-all duration-200
            focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none
            placeholder:text-[var(--text-muted)]
            ${Icon ? 'pl-12' : 'pl-4'}
            ${error ? 'border-[var(--error)] focus:ring-[var(--error)]' : ''}
            ${className}
          `}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        )}
      </div>
      {error && (
        <p className="text-xs text-[var(--error)] ml-1 font-medium animate-in fade-in slide-in-from-top-1">
          {error}
        </p>
      )}
    </div>
  );
};

export default Input;
