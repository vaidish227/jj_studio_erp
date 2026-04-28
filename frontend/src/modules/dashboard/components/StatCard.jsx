import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import Card from '../../../shared/components/Card/Card';

/**
 * StatCard — shows a metric with label, value, trend, and icon.
 * Props: label, value, trend ("+12% from last month"), trendUp (bool), icon (JSX), iconBg (tailwind class)
 */
const StatCard = ({
  label,
  value,
  trend,
  trendUp = true,
  icon,
  iconBg = 'bg-[var(--primary)]/10',
  compact = false,
}) => {
  return (
    <Card className="flex flex-col gap-3">
      {/* Label + Icon row */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--text-secondary)]">{label}</p>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
      </div>

      {/* Value */}
      <p className={`${compact ? 'text-2xl' : 'text-3xl'} font-bold text-[var(--text-primary)]`}>{value}</p>

      {/* Trend */}
      <div className={`flex items-center gap-1.5 text-sm font-medium ${trendUp ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
        {trendUp
          ? <TrendingUp size={15} strokeWidth={2.5} />
          : <TrendingDown size={15} strokeWidth={2.5} />
        }
        <span>{trend || 'Live CRM data'}</span>
      </div>
    </Card>
  );
};

export default StatCard;
