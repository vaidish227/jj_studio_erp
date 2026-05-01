import React from 'react';

const ActionBar = ({ children, className = '' }) => {
  return (
    <div className={`sticky bottom-0 left-0 right-0 bg-[var(--surface)] border-t border-[var(--border)] p-4 shadow-lg z-30 ${className}`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {children}
      </div>
    </div>
  );
};

export default ActionBar;
