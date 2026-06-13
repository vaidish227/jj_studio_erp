import React from 'react';

const HorizontalBarChart = ({
  data = [],
  color = 'var(--primary)',
  onItemClick,
  emptyMessage = 'No data available.',
  className = '',
}) => {
  if (!data.length) {
    return (
      <div className={`flex items-center justify-center text-sm text-[var(--text-muted)] py-12 ${className}`}>
        {emptyMessage}
      </div>
    );
  }

  const max = Math.max(...data.map((d) => Number(d.value) || 0), 1);

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {data.map((item, i) => {
        const widthPct = Math.max(4, (item.value / max) * 100);
        const clickable = !!onItemClick;
        return (
          <div
            key={item.label || i}
            className={`group flex items-center gap-3 ${
              clickable ? 'cursor-pointer' : ''
            }`}
            onClick={clickable ? () => onItemClick(item) : undefined}
          >
            <div className="w-24 text-xs font-semibold text-[var(--text-secondary)] truncate group-hover:text-[var(--primary)] transition-colors">
              {item.label}
            </div>
            <div className="flex-1 relative h-7 rounded-lg bg-[var(--bg)] overflow-hidden">
              <div
                className="h-full rounded-lg transition-all duration-700 ease-out"
                style={{
                  width: `${widthPct}%`,
                  background: `linear-gradient(90deg, ${color} 0%, color-mix(in srgb, ${color} 70%, white) 100%)`,
                }}
              />
              <div className="absolute inset-y-0 right-2 flex items-center text-xs font-bold text-[var(--text-primary)] tabular-nums">
                {item.value}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default HorizontalBarChart;
