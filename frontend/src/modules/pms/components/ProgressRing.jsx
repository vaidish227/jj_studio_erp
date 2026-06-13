import React from 'react';

/**
 * ProgressRing — Phase 3a.
 * Compact circular progress indicator for project completion %.
 *
 * Props:
 *   - value    (0-100)
 *   - size     pixel size (default 44)
 *   - stroke   ring thickness (default 4)
 *   - label    optional override; default shows "<value>%"
 *   - showText render the percent text inside (default true)
 *
 * Colour bands tuned to give a sense of where the project sits:
 *   0-24:  text-muted (just started)
 *   25-49: accent-blue (in motion)
 *   50-74: primary    (well underway)
 *   75-99: warning    (final push)
 *   100:   success    (done)
 */
const ProgressRing = ({ value = 0, size = 44, stroke = 4, label, showText = true, className = '' }) => {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (v / 100) * circ;

  let color = 'var(--text-muted)';
  if (v >= 100) color = 'var(--success)';
  else if (v >= 75) color = 'var(--warning)';
  else if (v >= 50) color = 'var(--primary)';
  else if (v >= 25) color = 'var(--accent-blue)';

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="var(--border)" strokeWidth={stroke} fill="none"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 400ms ease' }}
        />
      </svg>
      {showText && (
        <span
          className="absolute font-black"
          style={{
            fontSize: Math.max(9, Math.round(size / 4)),
            color,
            letterSpacing: '-0.02em',
          }}
        >
          {label ?? `${v}%`}
        </span>
      )}
    </div>
  );
};

export default ProgressRing;
