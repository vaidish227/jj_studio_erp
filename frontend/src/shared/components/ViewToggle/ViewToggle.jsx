import React from 'react';
import { LayoutGrid, List } from 'lucide-react';

const ViewToggle = ({ view, onViewChange, className = "" }) => {
  return (
    <div className={`flex items-center gap-1 p-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl w-fit ${className}`}>
      <button
        type="button"
        onClick={() => onViewChange('calendar')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
          view === 'calendar' 
            ? 'bg-[var(--primary)] text-black shadow-sm' 
            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)]'
        }`}
      >
        <LayoutGrid size={16} />
        <span className="hidden sm:inline">Calendar View</span>
        <span className="sm:hidden">Calendar</span>
      </button>
      <button
        type="button"
        onClick={() => onViewChange('list')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
          view === 'list' 
            ? 'bg-[var(--primary)] text-black shadow-sm' 
            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)]'
        }`}
      >
        <List size={16} />
        <span className="hidden sm:inline">List View</span>
        <span className="sm:hidden">List</span>
      </button>
    </div>
  );
};

export default ViewToggle;
