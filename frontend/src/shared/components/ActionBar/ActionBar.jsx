import React from 'react';

const ActionBar = ({ children, className = '' }) => {
  return (
    <div className={`flex items-center gap-3 p-4 bg-white border border-[var(--border)] rounded-2xl shadow-sm ${className}`}>
      {children}
    </div>
  );
};

export default ActionBar;
