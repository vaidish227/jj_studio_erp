import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../../shared/components/Card/Card';

const SummaryCard = ({ title, value, icon: Icon, color, path, percentage }) => {
  const navigate = useNavigate();

  return (
    <Card 
      className="group cursor-pointer hover:shadow-lg hover:shadow-[var(--primary)]/5 transition-all duration-300 border-none bg-gradient-to-br from-[var(--surface)] to-[var(--bg)]/50"
      padding="p-6"
    >
      <div className="flex items-start justify-between" onClick={() => path && navigate(path)}>
        <div className="space-y-4">
          <div className={`p-3 rounded-xl ${color} bg-opacity-10 inline-flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
            <Icon size={24} className={color.replace('bg-', 'text-')} />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wider">{title}</p>
            <h3 className="text-3xl font-bold text-[var(--text-primary)] mt-1">{value}</h3>
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
      </div>
    </Card>
  );
};

export default SummaryCard;
