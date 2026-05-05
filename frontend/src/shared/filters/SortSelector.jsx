import { useState, useRef, useEffect } from 'react';
import { ArrowUpDown, X } from 'lucide-react';
import { SORT_OPTIONS } from './FilterConfig';

/**
 * Sort selector component with alphabet and date sorting options
 */
const SortSelector = ({
  value,
  onChange,
  options = null,
  placeholder = 'Sort by...',
  className = '',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Use provided options or default sort options
  const sortOptions = options || SORT_OPTIONS;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle option selection
  const handleSelectOption = (option) => {
    onChange(option.value);
    setIsOpen(false);
  };

  // Get display text
  const getDisplayText = () => {
    const option = Object.values(sortOptions).find(opt => opt.value === value);
    return option?.label || placeholder;
  };

  const hasValue = value !== '';

  return (
    <div className={`relative w-48 ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] 
          rounded-lg text-left flex items-center justify-between gap-2
          hover:bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]
          transition-all duration-200
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${hasValue ? 'border-[var(--primary)] text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}
        `}
      >
        <div className="flex items-center gap-2 truncate">
          <ArrowUpDown size={14} />
          <span className="truncate">{getDisplayText()}</span>
        </div>
        <div className="flex items-center gap-1">
          {hasValue && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-0.5 rounded hover:bg-[var(--bg)] text-[var(--text-muted)]"
            >
              <X size={12} />
            </button>
          )}
          <ArrowUpDown 
            size={14} 
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Dropdown Content */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--surface)] 
          border border-[var(--border)] rounded-lg shadow-lg z-50 max-h-64 overflow-hidden">
          
          {/* Options List */}
          <div className="max-h-48 overflow-y-auto">
            {Object.values(sortOptions).map((option) => {
              const isSelected = value === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelectOption(option)}
                  className={`
                    w-full px-3 py-2 text-sm text-left flex items-center justify-between gap-2
                    hover:bg-[var(--bg)] transition-colors duration-150
                    ${isSelected ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'text-[var(--text-primary)]'}
                  `}
                >
                  <span className="truncate">{option.label}</span>
                  
                  {/* Selection indicator */}
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default SortSelector;
