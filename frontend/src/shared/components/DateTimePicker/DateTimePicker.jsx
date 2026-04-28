import React from 'react';
import { Calendar, Clock } from 'lucide-react';
import Input from '../Input/Input';

const DateTimePicker = ({ label, dateValue, timeValue, onDateChange, onTimeChange, error, required }) => {
  return (
    <div className="space-y-4">
      {label && (
        <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 block">
          {label} {required && <span className="text-[var(--error)]">*</span>}
        </label>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          type="date"
          icon={Calendar}
          value={dateValue}
          onChange={(e) => onDateChange(e.target.value)}
          required={required}
          className="w-full"
        />
        <Input
          type="time"
          icon={Clock}
          value={timeValue}
          onChange={(e) => onTimeChange(e.target.value)}
          required={required}
          className="w-full"
        />
      </div>
      {error && <p className="text-xs text-[var(--error)] font-medium mt-1">{error}</p>}
    </div>
  );
};

export default DateTimePicker;
