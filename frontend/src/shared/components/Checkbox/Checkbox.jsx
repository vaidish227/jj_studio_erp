import React from 'react';
import { Check } from 'lucide-react';

const Checkbox = ({ 
  label, 
  checked, 
  onChange, 
  id,
  className = "" 
}) => {
  return (
    <label 
      htmlFor={id}
      className={`flex items-center gap-2 cursor-pointer group select-none ${className}`}
    >
      <div className="relative">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={onChange}
          className="peer sr-only"
        />
        <div className="w-5 h-5 border-2 border-[var(--border)] rounded-md transition-all duration-200 peer-checked:bg-[var(--primary)] peer-checked:border-[var(--primary)] group-hover:border-[var(--primary)]" />
        <Check 
          size={14} 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-black opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" 
          strokeWidth={3}
        />
      </div>
      {label && (
        <span className="text-sm font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
          {label}
        </span>
      )}
    </label>
  );
};

export default Checkbox;
