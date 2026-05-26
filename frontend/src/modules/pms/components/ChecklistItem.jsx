import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';

const ChecklistItem = ({ item, isCompleted, completedAt, onToggle, disabled = false }) => {
  const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={`w-full flex items-start gap-3 text-left py-2 px-1 rounded-lg
                  hover:bg-[var(--bg)] transition-colors group
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {isCompleted
        ? <CheckCircle2 size={16} className="text-[var(--success)] mt-0.5 shrink-0" />
        : <Circle size={16} className="text-[var(--border)] mt-0.5 shrink-0 group-hover:text-[var(--primary)] transition-colors" />
      }
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${isCompleted ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
          {item}
        </p>
        {isCompleted && completedAt && (
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Done {fmt(completedAt)}</p>
        )}
      </div>
    </button>
  );
};

export default ChecklistItem;
