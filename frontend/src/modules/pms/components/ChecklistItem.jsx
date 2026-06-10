import React from 'react';
import { Check } from 'lucide-react';

const ChecklistItem = ({ item, isCompleted, completedAt, onToggle, disabled = false }) => {
  const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={`group w-full flex items-center gap-3 text-left p-2.5 rounded-xl border transition-all duration-150
        ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
        ${isCompleted
          ? 'bg-[var(--success)]/[0.06] border-[var(--success)]/25'
          : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--primary)]/45 hover:bg-[var(--primary)]/[0.03]'}`}
    >
      {/* Custom checkbox */}
      <span
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all duration-150
          ${isCompleted
            ? 'bg-[var(--success)] border-[var(--success)] scale-100'
            : 'border-[var(--divider)] bg-[var(--bg)] group-hover:border-[var(--primary)]'}`}
      >
        <Check
          size={13}
          strokeWidth={3}
          className={`text-white transition-all duration-150 ${isCompleted ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
        />
      </span>

      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug transition-colors ${isCompleted ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)] font-medium'}`}>
          {item}
        </p>
        {isCompleted && completedAt && (
          <p className="text-[10px] text-[var(--success)] font-semibold mt-0.5 flex items-center gap-1">
            <Check size={9} strokeWidth={3} /> Done {fmt(completedAt)}
          </p>
        )}
      </div>
    </button>
  );
};

export default ChecklistItem;
