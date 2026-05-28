import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';

/**
 * Reusable dropdown component for filters
 * Supports single select, multi-select, and search within dropdown
 */
const FilterDropdown = ({
  label,
  options = [],
  value,
  onChange,
  placeholder = 'Select...',
  multiSelect = false,
  searchable = false,
  width = 'w-48',
  className = '',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter options based on search term
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle option selection
  const handleSelectOption = (option) => {
    if (multiSelect) {
      const newValue = Array.isArray(value) ? [...value] : [];
      if (newValue.includes(option.value)) {
        // Remove option
        onChange(newValue.filter(v => v !== option.value));
      } else {
        // Add option
        onChange([...newValue, option.value]);
      }
    } else {
      onChange(option.value);
      setIsOpen(false);
    }
  };

  // Get display text
  const getDisplayText = () => {
    if (multiSelect) {
      if (!Array.isArray(value) || value.length === 0) return placeholder;
      if (value.length === 1) {
        const option = options.find(opt => opt.value === value[0]);
        return option?.label || placeholder;
      }
      return `${value.length} selected`;
    } else {
      const option = options.find(opt => opt.value === value);
      return option?.label || placeholder;
    }
  };

  // Clear selection
  const handleClear = (e) => {
    e.stopPropagation();
    onChange(multiSelect ? [] : '');
  };

  const hasValue = multiSelect 
    ? (Array.isArray(value) && value.length > 0)
    : (value !== '');

  return (
    <div className={`relative ${width} ${className}`} ref={dropdownRef}>
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
        <span className="truncate">{getDisplayText()}</span>
        <div className="flex items-center gap-1">
          {hasValue && (
            <div
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-[var(--bg)] text-[var(--text-muted)] cursor-pointer"
              role="button"
              tabIndex={0}
            >
              <X size={12} />
            </div>
          )}
          <ChevronDown 
            size={14} 
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Dropdown Content — widens beyond the trigger if labels need more room */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-full w-max max-w-[260px] bg-[var(--surface)]
          border border-[var(--border)] rounded-lg shadow-lg z-50 overflow-hidden">

          {/* Search Input */}
          {searchable && filteredOptions.length > 5 && (
            <div className="p-2 border-b border-[var(--border)]">
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-2 py-1 text-sm bg-[var(--bg)] border border-[var(--border)]
                  rounded focus:outline-none focus:border-[var(--primary)]"
                autoFocus
              />
            </div>
          )}

          {/* Multi-select hint + actions */}
          {multiSelect && filteredOptions.length > 0 && (
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border)] bg-[var(--bg)]/40">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                Pick one or more
              </span>
              {Array.isArray(value) && value.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onChange([]); }}
                  className="text-[10px] font-bold text-[var(--primary)] hover:underline"
                >
                  Clear ({value.length})
                </button>
              )}
            </div>
          )}

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto custom-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = multiSelect
                  ? (Array.isArray(value) && value.includes(option.value))
                  : (value === option.value);

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelectOption(option)}
                    className={`
                      w-full px-3 py-2 text-sm text-left flex items-center gap-2.5
                      hover:bg-[var(--bg)] transition-colors duration-150
                      ${isSelected && !multiSelect ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'text-[var(--text-primary)]'}
                    `}
                  >
                    {/* Selection indicator — checkbox for multi-select, dot for single-select */}
                    {multiSelect ? (
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'border-[var(--primary)] bg-[var(--primary)]'
                            : 'border-[var(--border)] bg-[var(--surface)]'
                        }`}
                      >
                        {isSelected && <Check size={11} strokeWidth={3} className="text-black" />}
                      </span>
                    ) : (
                      option.color && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: `var(--${option.color}, currentColor)` }}
                        />
                      )
                    )}

                    <span className="truncate flex-1">{option.label}</span>

                    {/* Check on the right for single-select active option */}
                    {!multiSelect && isSelected && (
                      <Check size={14} className="text-[var(--primary)] shrink-0" />
                    )}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-4 text-sm text-[var(--text-muted)] text-center">
                {searchTerm ? 'No options found' : 'No options available'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterDropdown;
