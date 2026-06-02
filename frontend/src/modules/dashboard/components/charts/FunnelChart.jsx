import React from 'react';
import { TrendingDown } from 'lucide-react';

const FunnelChart = ({ stages = [], className = '' }) => {
  if (!stages.length) {
    return (
      <div className={`flex items-center justify-center text-sm text-[var(--text-muted)] py-12 ${className}`}>
        No funnel data.
      </div>
    );
  }

  const maxValue = Math.max(...stages.map((s) => s.value || 0), 1);

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {stages.map((stage, i) => {
        const widthPct = Math.max(8, (stage.value / maxValue) * 100);
        const prev = i > 0 ? stages[i - 1].value : null;
        const conversion =
          prev != null && prev > 0
            ? Math.round((stage.value / prev) * 1000) / 10
            : null;
        const dropped = prev != null && conversion != null && conversion < 100;

        return (
          <div key={stage.key || i} className="relative">
            {/* Conversion pill (between bars) */}
            {conversion != null && (
              <div className="flex items-center gap-1.5 pl-2 mb-1">
                <TrendingDown
                  size={12}
                  className={dropped ? 'text-[var(--error)]' : 'text-[var(--success)]'}
                />
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    dropped ? 'text-[var(--error)]' : 'text-[var(--success)]'
                  }`}
                >
                  {conversion}% conversion
                </span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div
                className="relative flex items-center justify-between rounded-xl px-4 py-3 transition-all duration-700 ease-out group hover:shadow-md"
                style={{
                  width: `${widthPct}%`,
                  background: `linear-gradient(135deg, ${stage.color || 'var(--primary)'} 0%, ${stage.colorEnd || stage.color || 'var(--primary)'} 100%)`,
                  minWidth: '120px',
                }}
              >
                <span className="text-xs font-bold text-white uppercase tracking-wide truncate">
                  {stage.label}
                </span>
                <span className="text-base font-extrabold text-white tabular-nums">
                  {stage.value}
                </span>
              </div>
              <div className="text-xs text-[var(--text-muted)] font-medium tabular-nums">
                {maxValue > 0 ? Math.round((stage.value / maxValue) * 100) : 0}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FunnelChart;
