import React, { useId } from 'react';

const Sparkline = ({
  data = [],
  color = 'var(--primary)',
  height = 36,
  width = 120,
  fill = true,
  strokeWidth = 1.6,
  className = '',
}) => {
  const id = useId();
  const gradientId = `spark-grad-${id.replace(/[:]/g, '')}`;

  if (!data.length) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={`block w-full ${className}`}
        style={{ height }}
        aria-hidden
      />
    );
  }

  const values = data.map((d) => (typeof d === 'number' ? d : d.value || 0));
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;

  const n = values.length;
  const step = n > 1 ? width / (n - 1) : 0;

  const pts = values.map((v, i) => {
    const x = n === 1 ? width / 2 : i * step;
    const y = height - ((v - min) / span) * (height - 4) - 2;
    return [x, y];
  });

  const linePath = pts
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(' ');

  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={`block w-full ${className}`}
      style={{ height }}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={areaPath} fill={`url(#${gradientId})`} />}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default Sparkline;
