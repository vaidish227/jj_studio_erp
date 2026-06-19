// Shared chart theming for the Delegation dashboard. Recharts needs concrete
// color values for some props (gradient stops, axis strokes), so we resolve the
// theme.css custom properties to their computed hex at render time — this keeps
// charts in sync with the active "Modern Luxe" palette (and any future themes)
// without rebuilding. Mirrors the helper used by the PMS dashboard charts.

export const resolveVar = (value) => {
  if (typeof window === 'undefined' || typeof value !== 'string' || !value.startsWith('var(')) {
    return value;
  }
  const match = /var\((--[^),]+)/.exec(value);
  if (!match) return value;
  const computed = getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim();
  return computed || value;
};

// Status → theme token. Stable so the donut/legend colors never reshuffle.
export const STATUS_COLOR = {
  created:     'var(--text-muted)',
  assigned:    'var(--primary)',
  in_progress: 'var(--accent-blue)',
  review:      'var(--warning)',
  completed:   'var(--success)',
  reopened:    'var(--error)',
  cancelled:   'var(--divider)',
};

// Priority → theme token (severity ramp).
export const PRIORITY_COLOR = {
  urgent: 'var(--error)',
  high:   'var(--warning)',
  medium: 'var(--accent-blue)',
  low:    'var(--success)',
};
