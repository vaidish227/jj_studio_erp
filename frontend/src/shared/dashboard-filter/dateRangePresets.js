/**
 * Date-range presets shared across all dashboards.
 *
 * The backend resolver (backend/.../resolveDateRange.js) is the single source of
 * truth for the actual window math. The frontend only carries the preset id +
 * display label, and for custom ranges the YYYY-MM-DD from/to strings.
 *
 * NOTE: storage key, default range, and dashboard-specific legacy mappings are
 * intentionally NOT here — they live in each dashboard's config (see
 * modules/<m>/config/*.js) so dashboards don't share persisted state or defaults.
 */

export const DATE_PRESETS = [
  { id: 'today',        label: 'Today'        },
  { id: 'yesterday',    label: 'Yesterday'    },
  { id: 'last_7_days',  label: 'Last 7 Days'  },
  { id: 'last_30_days', label: 'Last 30 Days' },
  { id: 'last_90_days', label: 'Last 90 Days' },
  { id: 'this_month',   label: 'This Month'   },
  { id: 'last_month',   label: 'Last Month'   },
  { id: 'all_time',     label: 'All Time'     },
];

const VALID_IDS = new Set([...DATE_PRESETS.map((p) => p.id), 'custom']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Legacy ?period= vocabulary (older deep-links + the PMS dashboard widgets use
// these) → preset id. Kept here so every URL-driven page parses links the same way.
export const LEGACY_PERIOD_TO_PRESET = {
  week: 'last_7_days', month: 'last_30_days', quarter: 'last_90_days', all: 'all_time',
};

/** A range is { preset } or { preset:'custom', from:'YYYY-MM-DD', to:'YYYY-MM-DD' }. */
export const isValidRange = (r) => {
  if (!r || typeof r !== 'object' || !VALID_IDS.has(r.preset)) return false;
  if (r.preset === 'custom') {
    return ISO_DATE.test(r.from || '') && ISO_DATE.test(r.to || '') && r.from <= r.to;
  }
  return true;
};

// 'YYYY-MM-DD' → 'd MMM' (local, en-IN) for compact custom-range labels.
const fmtDay = (iso) => {
  const m = ISO_DATE.test(iso || '') ? iso.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  if (!m) return iso || '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export const formatRangeLabel = (range) => {
  if (!range) return 'Date range';
  if (range.preset === 'custom') return `${fmtDay(range.from)} – ${fmtDay(range.to)}`;
  return (DATE_PRESETS.find((p) => p.id === range.preset) || {}).label || 'Date range';
};

/**
 * Build query params from a range descriptor (uniform across dashboards whose
 * backend speaks the resolveDateRange contract: ?preset= or ?from=&to=):
 *   { preset: 'last_7_days' }       → { preset: 'last_7_days' }
 *   { preset: 'custom', from, to }  → { from, to }
 *   'last_7_days' (bare string)     → { preset: 'last_7_days' }  (back-compat)
 */
export const rangeToParams = (range) => {
  if (typeof range === 'string') return { preset: range };
  const { preset, from, to } = range || {};
  if (preset === 'custom' || (from && to)) return { from, to };
  if (preset) return { preset };
  return { preset: 'last_30_days' };
};

/**
 * Parse a URLSearchParams into a range descriptor, in priority order:
 *   ?from=&to=  → { preset:'custom', from, to }
 *   ?preset=    → { preset }
 *   ?period=    → legacy alias mapped to a preset
 * Falls back to `fallback` (default last_30_days) when nothing valid is present.
 */
export const rangeFromSearchParams = (sp, fallback = { preset: 'last_30_days' }) => {
  const from = sp.get('from');
  const to = sp.get('to');
  if (from && to) {
    const r = { preset: 'custom', from, to };
    if (isValidRange(r)) return r;
  }
  const preset = sp.get('preset');
  if (preset && isValidRange({ preset })) return { preset };
  const legacy = sp.get('period');
  if (legacy && LEGACY_PERIOD_TO_PRESET[legacy]) return { preset: LEGACY_PERIOD_TO_PRESET[legacy] };
  return fallback;
};

/**
 * Mutate a URLSearchParams in place to reflect `range`, clearing the alternate
 * keys so the URL never carries a stale ?period= alongside a fresh ?preset=.
 */
export const writeRangeToSearchParams = (sp, range) => {
  ['period', 'preset', 'from', 'to'].forEach((k) => sp.delete(k));
  if (range?.preset === 'custom') {
    sp.set('from', range.from);
    sp.set('to', range.to);
  } else if (range?.preset) {
    sp.set('preset', range.preset);
  }
  return sp;
};
