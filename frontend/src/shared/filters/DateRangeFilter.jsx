import { useState, useRef, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';

/**
 * Date range filter component with calendar picker
 */
const DateRangeFilter = ({
  value,
  onChange,
  placeholder = 'Select date range',
  className = '',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const dropdownRef = useRef(null);

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

  
  // Handle apply
  const handleApply = () => {
    if (startDate || endDate) {
      onChange({
        start: startDate || null,
        end: endDate || null
      });
    } else {
      onChange(null);
    }
    setIsOpen(false);
  };

  // Handle clear
  const handleClear = () => {
    setStartDate('');
    setEndDate('');
    onChange(null);
    setIsOpen(false);
  };

  // Format display text
  const getDisplayText = () => {
    if (!value || (!value.start && !value.end)) return placeholder;
    
    const start = value.start ? new Date(value.start).toLocaleDateString() : '';
    const end = value.end ? new Date(value.end).toLocaleDateString() : '';
    
    if (start && end) return `${start} → ${end}`;
    if (start) return `From ${start}`;
    if (end) return `Until ${end}`;
    
    return placeholder;
  };

  const hasValue = value && (value.start || value.end);

  return (
    <div className={`relative w-64 ${className}`} ref={dropdownRef}>
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
          <Calendar size={14} />
          <span className="truncate">{getDisplayText()}</span>
        </div>
        <div className="flex items-center gap-1">
          {hasValue && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="p-0.5 rounded hover:bg-[var(--bg)] text-[var(--text-muted)]"
            >
              <X size={12} />
            </button>
          )}
          <Calendar 
            size={14} 
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Dropdown Content */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--surface)] 
          border border-[var(--border)] rounded-lg shadow-lg z-50 p-4">
          
          <div className="space-y-3">
            {/* Start Date */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2 py-1 text-sm bg-[var(--bg)] border border-[var(--border)]
                  rounded focus:outline-none focus:border-[var(--primary)]"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="w-full px-2 py-1 text-sm bg-[var(--bg)] border border-[var(--border)]
                  rounded focus:outline-none focus:border-[var(--primary)]"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleApply}
                className="flex-1 px-3 py-1 text-xs font-medium bg-[var(--primary)] 
                  text-black rounded hover:bg-[var(--primary-hover)] transition-colors"
              >
                Apply
              </button>
              <button
                onClick={handleClear}
                className="px-3 py-1 text-xs font-medium bg-[var(--bg)] 
                  text-[var(--text-muted)] rounded hover:bg-[var(--border)] transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangeFilter;
