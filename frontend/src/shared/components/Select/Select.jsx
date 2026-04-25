import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Select — dropdown with options.
 * Props: label, value, onChange, options [{value, label}], placeholder, error, className
 */
const Select = ({
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  error,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={`relative w-full ${className}`}>
      {label && (
        <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2 ml-0.5">
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`
          w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm
          bg-[var(--surface)] transition-all duration-200
          focus:outline-none focus:ring-1 focus:ring-[var(--primary)]
          ${error
            ? 'border-[var(--error)] text-[var(--error)]'
            : open
              ? 'border-[var(--primary)]'
              : 'border-[var(--border)] text-[var(--text-primary)]'
          }
        `}
      >
        <span className={selected ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`text-[var(--text-muted)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul className="
          absolute z-50 w-full mt-1.5 bg-[var(--surface)] border border-[var(--border)]
          rounded-xl shadow-lg overflow-hidden
        ">
          {options.map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`
                  w-full text-left px-4 py-2.5 text-sm transition-colors
                  ${opt.value === value
                    ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-semibold'
                    : 'text-[var(--text-primary)] hover:bg-[var(--bg)]'
                  }
                `}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="text-xs text-[var(--error)] font-medium mt-1 ml-0.5">{error}</p>
      )}
    </div>
  );
};

export default Select;
