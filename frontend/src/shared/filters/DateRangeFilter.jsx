import { useState, useRef, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';
import DatePicker from '../components/DatePicker/DatePicker';

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
    <div className={`relative w-52 ${className}`} ref={dropdownRef}>
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

      {/* Dropdown Content — width must comfortably contain the DatePicker
          calendar popover (300px) so it doesn't visually overflow. */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-[var(--surface)]
          border border-[var(--border)] rounded-lg shadow-lg z-50 p-4 w-[340px]">

          <div className="space-y-3">
            {/* Start Date — uses the same DatePicker as the Enquiry form */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Start Date
              </label>
              <DatePicker
                name="start"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="Pick a start date"
                max={endDate || undefined}
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                End Date
              </label>
              <DatePicker
                name="end"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="Pick an end date"
                min={startDate || undefined}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleApply}
                className="flex-1 px-3 py-1.5 text-xs font-bold bg-[var(--primary)]
                  text-black rounded hover:opacity-90 transition-opacity"
              >
                Apply
              </button>
              <button
                onClick={handleClear}
                className="px-3 py-1.5 text-xs font-bold bg-[var(--bg)]
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
