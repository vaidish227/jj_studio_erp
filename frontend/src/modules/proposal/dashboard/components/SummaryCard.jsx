import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../../shared/components/Card/Card';

const SummaryCard = ({ title, value, icon: Icon, color, path, percentage }) => {
  const navigate = useNavigate();

  // Map generic colors to specific text and bg classes to avoid tailwind purge issues
  const colorMap = {
    'blue': 'text-blue-500 bg-blue-500/10',
    'orange': 'text-orange-500 bg-orange-500/10',
    'green': 'text-green-500 bg-green-500/10',
    'red': 'text-red-500 bg-red-500/10',
    'purple': 'text-purple-500 bg-purple-500/10',
    'indigo': 'text-indigo-500 bg-indigo-500/10',
    'teal': 'text-teal-500 bg-teal-500/10',
  };

  const themeClasses = colorMap[color] || colorMap['blue'];

  return (
    <Card 
      className="group cursor-pointer hover:shadow-lg hover:shadow-[var(--primary)]/5 transition-all duration-300 border border-[var(--border)] bg-[var(--surface)]"
      padding="p-5"
    >
      <div className="flex flex-col h-full" onClick={() => path && navigate(path)}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2.5 rounded-xl ${themeClasses} transition-transform duration-300 group-hover:scale-110 flex-shrink-0`}>
            <Icon size={20} />
          </div>
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider leading-tight line-clamp-2">{title}</p>
        </div>
        <div>
          <h3 className="text-2xl font-black text-[var(--text-primary)]">{value}</h3>
        </div>
        {percentage && (
          <div className="flex items-center gap-1.5 mt-2">
            <span className={`text-xs font-bold ${percentage > 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
              {percentage > 0 ? '+' : ''}{percentage}%
            </span>
            <span className="text-[10px] text-[var(--text-muted)] uppercase font-medium">vs last month</span>
          </div>
        )}
      </div>
    </Card>
  );
};

export default SummaryCard;
