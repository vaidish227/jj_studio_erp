import React from 'react';
import Card from '../Card/Card';

const SectionCard = ({ title, children, className = '', headerActions }) => {
  return (
    <Card className={`overflow-hidden ${className}`}>
      {title && (
        <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--bg)] flex items-center justify-between">
          <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">{title}</h3>
          {headerActions && <div>{headerActions}</div>}
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </Card>
  );
};

export default SectionCard;
