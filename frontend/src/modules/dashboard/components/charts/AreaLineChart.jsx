import React, { useId, useMemo, useRef, useState } from 'react';

const formatDate = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch {
    return iso;
  }
};

const niceMax = (max) => {
  if (max <= 5) return 5;
  if (max <= 10) return 10;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / pow;
  if (n <= 2) return 2 * pow;
  if (n <= 5) return 5 * pow;
  return 10 * pow;
};

const AreaLineChart = ({
  data = [],
  color = 'var(--primary)',
  height = 260,
  className = '',
}) => {
  const id = useId().replace(/[:]/g, '');
  const gradId = `area-grad-${id}`;
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);

  const padding = { top: 16, right: 16, bottom: 28, left: 36 };
  const vbWidth = 600;
  const vbHeight = height;
  const innerW = vbWidth - padding.left - padding.right;
  const innerH = vbHeight - padding.top - padding.bottom;

  const { values, max, points, linePath, areaPath, yTicks } = useMemo(() => {
    const vals = data.map((d) => Number(d.value) || 0);
    const rawMax = Math.max(...vals, 1);
    const m = niceMax(rawMax);
    const n = vals.length;
    const step = n > 1 ? innerW / (n - 1) : 0;
    const pts = vals.map((v, i) => {
      const x = padding.left + (n === 1 ? innerW / 2 : i * step);
      const y = padding.top + innerH - (v / m) * innerH;
      return { x, y, v, date: data[i].date };
    });
    const lp = pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ');
    const ap = `${lp} L ${padding.left + (n > 1 ? innerW : innerW)} ${
      padding.top + innerH
    } L ${padding.left} ${padding.top + innerH} Z`;
    const tickCount = 4;
    const ticks = Array.from({ length: tickCount + 1 }, (_, i) => ({
      value: Math.round((m / tickCount) * i),
      y: padding.top + innerH - (i / tickCount) * innerH,
    }));
    return {
      values: vals,
      max: m,
      points: pts,
      linePath: lp,
      areaPath: ap,
      yTicks: ticks,
    };
  }, [data, innerH, innerW, padding.left, padding.top]);

  const handleMove = (e) => {
    if (!svgRef.current || !points.length) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = vbWidth / rect.width;
    const x = (e.clientX - rect.left) * scaleX;
    // find closest point
    let nearest = points[0];
    let nearestDx = Math.abs(x - nearest.x);
    for (let i = 1; i < points.length; i++) {
      const dx = Math.abs(x - points[i].x);
      if (dx < nearestDx) {
        nearest = points[i];
        nearestDx = dx;
      }
    }
    setHover(nearest);
  };

  const handleLeave = () => setHover(null);

  // x-axis labels — show every Nth label so they don't overlap
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));
  const xLabels = points.filter((_, i) => i % labelEvery === 0);

  if (!data.length) {
    return (
      <div className={`flex items-center justify-center text-sm text-[var(--text-muted)] ${className}`} style={{ height }}>
        No data in selected range.
      </div>
    );
  }

  return (
    <div className={`relative w-full ${className}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${vbWidth} ${vbHeight}`}
        className="block w-full"
        style={{ height }}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y grid lines + labels */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              x2={vbWidth - padding.right}
              y1={t.y}
              y2={t.y}
              stroke="var(--border)"
              strokeWidth="1"
              strokeDasharray={i === 0 ? '0' : '3 3'}
              opacity={i === 0 ? '1' : '0.6'}
            />
            <text
              x={padding.left - 8}
              y={t.y + 4}
              fontSize="10"
              fill="var(--text-muted)"
              textAnchor="end"
            >
              {t.value}
            </text>
          </g>
        ))}

        {/* Area + Line */}
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points (small dots) */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hover && hover.x === p.x ? 4.5 : 2.2}
            fill={hover && hover.x === p.x ? color : 'var(--surface)'}
            stroke={color}
            strokeWidth="1.5"
          />
        ))}

        {/* X labels */}
        {xLabels.map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={vbHeight - 8}
            fontSize="10"
            fill="var(--text-muted)"
            textAnchor="middle"
          >
            {formatDate(p.date)}
          </text>
        ))}

        {/* Hover crosshair */}
        {hover && (
          <g>
            <line
              x1={hover.x}
              x2={hover.x}
              y1={padding.top}
              y2={padding.top + innerH}
              stroke={color}
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.5"
            />
          </g>
        )}
      </svg>

      {/* Tooltip — DOM, positioned over SVG */}
      {hover && (
        <div
          className="absolute pointer-events-none px-3 py-2 rounded-lg bg-[var(--text-primary)] text-[var(--surface)] text-xs font-semibold shadow-lg"
          style={{
            left: `${(hover.x / vbWidth) * 100}%`,
            top: `${(hover.y / vbHeight) * 100}%`,
            transform: 'translate(-50%, calc(-100% - 12px))',
            whiteSpace: 'nowrap',
          }}
        >
          <div className="text-[10px] uppercase tracking-wide opacity-70">{formatDate(hover.date)}</div>
          <div className="text-sm font-bold">{hover.v} {hover.v === 1 ? 'lead' : 'leads'}</div>
        </div>
      )}
    </div>
  );
};

export default AreaLineChart;
