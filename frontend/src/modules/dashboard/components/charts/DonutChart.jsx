import React, { useMemo, useState } from 'react';

const polarToCartesian = (cx, cy, r, angle) => {
  const a = (angle - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
};

const arcPath = (cx, cy, rOuter, rInner, startAngle, endAngle) => {
  const startOuter = polarToCartesian(cx, cy, rOuter, endAngle);
  const endOuter = polarToCartesian(cx, cy, rOuter, startAngle);
  const startInner = polarToCartesian(cx, cy, rInner, startAngle);
  const endInner = polarToCartesian(cx, cy, rInner, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArcFlag} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${rInner} ${rInner} 0 ${largeArcFlag} 1 ${endInner.x} ${endInner.y}`,
    'Z',
  ].join(' ');
};

const DonutChart = ({
  data = [],
  size = 200,
  thickness = 28,
  centerLabel = '',
  centerValue,
  showLegend = true,
  className = '',
}) => {
  const [hoverIdx, setHoverIdx] = useState(null);

  const { slices, total } = useMemo(() => {
    const filtered = data.filter((d) => d.value > 0);
    const t = filtered.reduce((sum, d) => sum + d.value, 0);
    let angle = 0;
    const out = filtered.map((d, idx) => {
      const portion = t === 0 ? 0 : d.value / t;
      const sweep = portion * 360;
      const start = angle;
      const end = angle + sweep;
      angle = end;
      return { ...d, idx, start, end, portion };
    });
    return { slices: out, total: t };
  }, [data]);

  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2;
  const rInner = rOuter - thickness;

  const hoveredSlice = hoverIdx != null ? slices[hoverIdx] : null;
  const displayValue =
    hoveredSlice != null
      ? hoveredSlice.value
      : (centerValue !== undefined ? centerValue : total);
  const displayLabel =
    hoveredSlice != null
      ? hoveredSlice.label
      : centerLabel || 'Total';

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
          {/* Background ring */}
          <circle
            cx={cx}
            cy={cy}
            r={(rOuter + rInner) / 2}
            fill="none"
            stroke="var(--border)"
            strokeWidth={thickness - 2}
            opacity="0.4"
          />
          {slices.length === 0 && (
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="11"
              fill="var(--text-muted)"
            >
              No data
            </text>
          )}
          {slices.map((s, i) => {
            // Single slice fallback to full circle path
            if (slices.length === 1) {
              return (
                <g key={i}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={(rOuter + rInner) / 2}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={thickness - 2}
                    onMouseEnter={() => setHoverIdx(i)}
                    onMouseLeave={() => setHoverIdx(null)}
                    style={{ cursor: 'pointer' }}
                  />
                </g>
              );
            }
            const path = arcPath(cx, cy, rOuter, rInner, s.start, s.end);
            const isHover = hoverIdx === i;
            return (
              <path
                key={i}
                d={path}
                fill={s.color}
                opacity={hoverIdx == null || isHover ? 1 : 0.35}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
                style={{ cursor: 'pointer', transition: 'opacity 200ms' }}
              />
            );
          })}
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] font-semibold">
            {displayLabel}
          </span>
          <span className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">
            {displayValue}
          </span>
          {hoveredSlice && total > 0 && (
            <span className="text-[10px] font-semibold text-[var(--text-secondary)] mt-0.5">
              {Math.round((hoveredSlice.value / total) * 100)}%
            </span>
          )}
        </div>
      </div>

      {showLegend && slices.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 w-full">
          {slices.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-xs cursor-pointer"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            >
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ background: s.color }}
              />
              <span className="text-[var(--text-secondary)] truncate flex-1">{s.label}</span>
              <span className="text-[var(--text-primary)] font-bold">{s.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DonutChart;
