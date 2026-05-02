import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../../shared/components/Card/Card';

const SummaryCard = ({ title, value, icon: Icon, color, path }) => {
  const navigate = useNavigate();

  // Map to CSS variable-based classes
  const colorMap = {
    primary: 'text-[var(--primary)] bg-[var(--primary)]/10',
    warning: 'text-[var(--warning)] bg-[var(--warning)]/10',
    success: 'text-[var(--success)] bg-[var(--success)]/10',
    error: 'text-[var(--error)] bg-[var(--error)]/10',
    blue: 'text-[var(--accent-blue)] bg-[var(--accent-blue)]/10',
    teal: 'text-[var(--accent-teal)] bg-[var(--accent-teal)]/10',
  };

  const themeClasses = colorMap[color] || colorMap['primary'];

  return (
    <Card
      className="group cursor-pointer hover:border-[var(--primary)]/30 hover:shadow-md transition-all duration-200"
      padding="p-4"
    >
      <div className="flex flex-col h-full" onClick={() => path && navigate(path)}>
        <div className="flex items-center gap-3 mb-3">
          <div className={`p-2 rounded-xl ${themeClasses} flex-shrink-0 transition-transform duration-200 group-hover:scale-105`}>
            <Icon size={18} />
          </div>
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider leading-tight line-clamp-2">{title}</p>
        </div>
        <h3 className="text-2xl font-bold text-[var(--text-primary)]">{value}</h3>
      </div>
    </Card>
  );
};

export default SummaryCard;
