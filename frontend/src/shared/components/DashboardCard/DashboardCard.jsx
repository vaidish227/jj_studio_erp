import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown } from 'lucide-react';
import Card from '../Card/Card';

/**
 * DashboardCard — Reusable component for dashboard metrics.
 * Now supports dynamic navigation.
 * 
 * Props:
 * - title: Card label (e.g., "Total Leads")
 * - value: Metric value (e.g., 120)
 * - icon: Lucide icon component (optional)
 * - iconBg: Tailwind background class for icon (optional)
 * - trend: Optional trend text (e.g., "+12% from last month")
 * - trendUp: Boolean to indicate trend direction
 * - redirectPath: Path to navigate to on click
 * - compact: Boolean for smaller layout
 */
const DashboardCard = ({
  title,
  value,
  icon: Icon,
  iconBg = 'bg-[var(--primary)]/10',
  trend,
  trendUp = true,
  redirectPath,
  compact = false,
}) => {
  const navigate = useNavigate();

  const handleCardClick = () => {
    if (redirectPath) {
      navigate(redirectPath);
    }
  };

  return (
    <div 
      onClick={handleCardClick}
      className={`
        relative group flex flex-col gap-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl transition-all duration-300 
        ${compact ? 'p-4' : 'p-6'} 
        ${redirectPath ? 'cursor-pointer hover:border-[var(--primary)] hover:shadow-xl hover:-translate-y-1 active:scale-[0.98]' : ''}
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-semibold text-[var(--text-secondary)] group-hover:text-[var(--primary)] transition-colors duration-300">
            {title}
          </p>
          <p className={`${compact ? 'text-2xl' : 'text-3xl'} font-extrabold text-[var(--text-primary)] tracking-tight`}>
            {value}
          </p>
        </div>
        {Icon && (
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:rotate-12 group-hover:scale-110 shadow-sm ${iconBg}`}>
            <Icon size={24} className="text-current" />
          </div>
        )}
      </div>

      {(trend || !compact) && (
        <div className={`flex items-center gap-2 text-sm font-bold ${trendUp ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
          <div className={`flex items-center justify-center w-5 h-5 rounded-full ${trendUp ? 'bg-[var(--success)]/10' : 'bg-[var(--error)]/10'}`}>
            {trendUp ? (
              <TrendingUp size={12} strokeWidth={3} />
            ) : (
              <TrendingDown size={12} strokeWidth={3} />
            )}
          </div>
          <span className="opacity-90">{trend || 'Live Analysis'}</span>
        </div>
      )}

      {/* Subtle indicator for clickable cards */}
      {redirectPath && (
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-6 h-6 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardCard;
