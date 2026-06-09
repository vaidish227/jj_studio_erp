// Shared chart colour helpers for PMS dashboard visualisations.
// Recharts needs concrete colour values, so we resolve CSS theme tokens to their
// computed value at render time — keeping charts in sync with the active theme.

export const cssVarToHex = (varName) => {
  if (typeof window === 'undefined') return varName;
  const m = /var\((--[^)]+)\)/.exec(varName);
  if (!m) return varName;
  const v = getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim();
  return v || varName;
};

// Distinct series palette for categorical charts (e.g. work-by-project).
export const SERIES_PALETTE = [
  'var(--primary)',
  'var(--accent-blue)',
  'var(--accent-teal)',
  'var(--accent-green)',
  'var(--warning)',
  'var(--error)',
  'var(--text-muted)',
];
