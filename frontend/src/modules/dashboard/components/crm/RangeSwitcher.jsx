import React from 'react';

const OPTIONS = [
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
];

const RangeSwitcher = ({ value = '3m', onChange, className = '' }) => {
  return (
    <div
      role="tablist"
      aria-label="Date range"
      className={`inline-flex items-center gap-1 p-1 rounded-xl bg-[var(--bg)] border border-[var(--border)] ${className}`}
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(opt.value)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${
              active
                ? 'bg-[var(--primary)] text-white shadow-sm shadow-[var(--primary)]/30'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

export default RangeSwitcher;
