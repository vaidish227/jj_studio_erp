import React from 'react';
import Card from '../Card/Card';

const SectionCard = ({ title, icon: Icon, children, className = '', headerAction }) => {
  return (
    <Card className={`overflow-hidden border-none shadow-sm ${className}`}>
      {(title || Icon || headerAction) && (
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            {Icon && <Icon size={16} className="text-[var(--primary)]" />}
            {title && (
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-900">
                {title}
              </h3>
            )}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </Card>
  );
};

export default SectionCard;
