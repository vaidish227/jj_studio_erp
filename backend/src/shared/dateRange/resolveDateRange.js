/**
 * resolveDateRange — framework-agnostic date-window resolver for the MD Dashboard.
 *
 * Turns a dashboard filter selection (a named preset, or an explicit from/to
 * custom range) into a concrete, timezone-correct window plus the matching
 * "previous period" used for delta/trend comparisons.
 *
 * Pure utility: no Express, no Mongoose, no I/O. Safe to unit-test in isolation
 * and to reuse from any module. `now` is injectable so tests are deterministic.
 *
 * ── Timezone ────────────────────────────────────────────────────────────────
 * All presets are computed against Asia/Kolkata (IST = UTC+05:30). IST has had
 * no daylight-saving since 1945, so a fixed +330-minute offset is exact — no
 * Intl / tz-database dependency required. "Today", "This Month", etc. therefore
 * mean the *local Indian* day/month, not the UTC one.
 *
 * The returned `start`/`end`/`prevStart`/`prevEnd` are native `Date` objects
 * (absolute UTC instants) ready to drop into a Mongo `$gte` / `$lte` match.
 * `end` is **inclusive** to the last millisecond of the IST day (…T23:59:59.999).
 *
 * ── API contract this maps to ───────────────────────────────────────────────
 *   ?preset=last_7_days            → resolveDateRange({ preset: 'last_7_days' })
 *   ?preset=this_month             → resolveDateRange({ preset: 'this_month' })
 *   ?from=2026-06-01&to=2026-06-15 → resolveDateRange({ from: '2026-06-01', to: '2026-06-15' })
 *
 * ── Output shape ────────────────────────────────────────────────────────────
 *   { start: Date, end: Date, prevStart: Date, prevEnd: Date, preset: string }
 *
 * ── Worked examples (assuming "now" = 2026-06-16 08:30 IST) ──────────────────
 *   today        start 2026-06-16 00:00:00.000 IST  end 2026-06-16 23:59:59.999 IST
 *                prev  2026-06-15 00:00:00.000 IST  …    2026-06-15 23:59:59.999 IST
 *   yesterday    start 2026-06-15 00:00:00.000 IST  end 2026-06-15 23:59:59.999 IST
 *   last_7_days  start 2026-06-10 00:00:00.000 IST  end 2026-06-16 23:59:59.999 IST   (7 days incl. today)
 *                prev  2026-06-03 00:00:00.000 IST  …    2026-06-09 23:59:59.999 IST
 *   last_30_days start 2026-05-18 00:00:00.000 IST  end 2026-06-16 23:59:59.999 IST   (30 days incl. today)
 *   this_month   start 2026-06-01 00:00:00.000 IST  end 2026-06-16 23:59:59.999 IST   (month-to-date)
 *                prev  2026-05-16 00:00:00.000 IST  …    2026-05-31 23:59:59.999 IST   (equal 16-day span)
 *   last_month   start 2026-05-01 00:00:00.000 IST  end 2026-05-31 23:59:59.999 IST   (full prev month)
 *   custom       start <from> 00:00:00.000 IST      end <to> 23:59:59.999 IST
 */

'use strict';

// Asia/Kolkata is a fixed UTC+05:30 — no DST, ever.
const IST_OFFSET_MINUTES = 330;
const OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;
const DAY_MS = 86400000;

const PRESETS = [
  'today',
  'yesterday',
  'last_7_days',
  'last_30_days',
  'last_90_days',
  'this_month',
  'last_month',
  'all_time',
  'custom',
];

/**
 * Typed error so a controller can map `.code` → HTTP 400 cleanly in Step 2.
 * Codes: MISSING_PRESET | UNKNOWN_PRESET | MISSING_RANGE | INVALID_DATE | INVALID_RANGE
 */
class DateRangeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DateRangeError';
    this.code = code;
  }
}

// ── IST calendar helpers ─────────────────────────────────────────────────────

/** IST wall-clock Y/M/D of a given UTC instant (ms). month is 0-based. */
function istParts(ms) {
  const shifted = new Date(ms + OFFSET_MS);
  return {
    y: shifted.getUTCFullYear(),
    mo: shifted.getUTCMonth(),
    d: shifted.getUTCDate(),
  };
}

/**
 * Start of an IST calendar day, returned as a UTC `Date`.
 * `Date.UTC` normalises out-of-range day/month values (e.g. d = 0 → last day of
 * the previous month, d = -13 → 13 days before the 1st), which we rely on for
 * the rolling presets and for `last_month`.
 */
function istDayStart(y, mo, d) {
  return new Date(Date.UTC(y, mo, d, 0, 0, 0, 0) - OFFSET_MS);
}

/** End of an IST calendar day (…23:59:59.999), inclusive, as a UTC `Date`. */
function istDayEnd(y, mo, d) {
  return new Date(Date.UTC(y, mo, d, 23, 59, 59, 999) - OFFSET_MS);
}

/** Strictly parse a 'YYYY-MM-DD' string and reject impossible dates (e.g. Feb 30). */
function parseDateOnly(value, field) {
  if (typeof value !== 'string') {
    throw new DateRangeError('INVALID_DATE', `"${field}" must be a 'YYYY-MM-DD' string.`);
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) {
    throw new DateRangeError('INVALID_DATE', `"${field}" must match YYYY-MM-DD (got "${value}").`);
  }
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  // Round-trip check catches overflow like 2026-02-30 → Mar 2.
  const probe = new Date(Date.UTC(y, mo, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo || probe.getUTCDate() !== d) {
    throw new DateRangeError('INVALID_DATE', `"${field}" is not a real calendar date (got "${value}").`);
  }
  return { y, mo, d };
}

/**
 * Previous window = the span of identical duration immediately preceding [start, end].
 * One uniform rule for every preset — predictable and trivially verifiable:
 *   prevEnd   = the millisecond before `start`
 *   prevStart = prevEnd shifted back by the window's full (inclusive) duration
 */
function withPrev(start, end, preset) {
  const durationMs = end.getTime() - start.getTime() + 1; // +1 because `end` is inclusive
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(start.getTime() - durationMs);
  return { start, end, prevStart, prevEnd, preset };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * @param {Object} input
 * @param {string} [input.preset]  one of PRESETS. Omit it and supply from/to to imply 'custom'.
 * @param {string} [input.from]    'YYYY-MM-DD' (IST day start), required for custom.
 * @param {string} [input.to]      'YYYY-MM-DD' (IST day end, inclusive), required for custom.
 * @param {Object} [options]
 * @param {Date|number} [options.now]  injectable "now" (Date or epoch ms) for deterministic tests.
 * @returns {{start: Date, end: Date, prevStart: Date, prevEnd: Date, preset: string}}
 * @throws {DateRangeError}
 */
function resolveDateRange(input = {}, options = {}) {
  const nowMs =
    options.now instanceof Date ? options.now.getTime()
    : typeof options.now === 'number' ? options.now
    : Date.now();

  let { preset } = input;
  const { from, to } = input;

  // Infer custom when a range is supplied without an explicit preset.
  if (!preset && (from != null || to != null)) preset = 'custom';
  if (!preset) {
    throw new DateRangeError('MISSING_PRESET', 'Provide a `preset`, or a `from`/`to` custom range.');
  }
  preset = String(preset).toLowerCase();
  if (!PRESETS.includes(preset)) {
    throw new DateRangeError('UNKNOWN_PRESET', `Unknown preset "${preset}". Valid: ${PRESETS.join(', ')}.`);
  }

  const t = istParts(nowMs);
  let start;
  let end;

  switch (preset) {
    case 'today':
      start = istDayStart(t.y, t.mo, t.d);
      end = istDayEnd(t.y, t.mo, t.d);
      break;

    case 'yesterday':
      start = istDayStart(t.y, t.mo, t.d - 1);
      end = istDayEnd(t.y, t.mo, t.d - 1);
      break;

    case 'last_7_days': // today + previous 6 days, inclusive
      start = istDayStart(t.y, t.mo, t.d - 6);
      end = istDayEnd(t.y, t.mo, t.d);
      break;

    case 'last_30_days': // today + previous 29 days, inclusive
      start = istDayStart(t.y, t.mo, t.d - 29);
      end = istDayEnd(t.y, t.mo, t.d);
      break;

    case 'last_90_days': // today + previous 89 days, inclusive
      start = istDayStart(t.y, t.mo, t.d - 89);
      end = istDayEnd(t.y, t.mo, t.d);
      break;

    case 'this_month': // 1st of current IST month → now (month-to-date)
      start = istDayStart(t.y, t.mo, 1);
      end = istDayEnd(t.y, t.mo, t.d);
      break;

    case 'last_month': // full previous calendar month (day 0 of this month = last day of prev)
      start = istDayStart(t.y, t.mo - 1, 1);
      end = istDayEnd(t.y, t.mo, 0);
      break;

    case 'all_time': // effectively unbounded — epoch → end of today (covers every record)
      start = new Date(0);
      end = istDayEnd(t.y, t.mo, t.d);
      break;

    case 'custom': {
      if (from == null || to == null) {
        throw new DateRangeError('MISSING_RANGE', 'Custom range requires both `from` and `to`.');
      }
      const f = parseDateOnly(from, 'from');
      const tt = parseDateOnly(to, 'to');
      start = istDayStart(f.y, f.mo, f.d);
      end = istDayEnd(tt.y, tt.mo, tt.d);
      if (end.getTime() < start.getTime()) {
        throw new DateRangeError('INVALID_RANGE', '`to` must not be earlier than `from`.');
      }
      break;
    }

    default:
      // Unreachable — guarded by the PRESETS check above.
      throw new DateRangeError('UNKNOWN_PRESET', `Unhandled preset "${preset}".`);
  }

  return withPrev(start, end, preset);
}

module.exports = {
  resolveDateRange,
  DateRangeError,
  PRESETS,
  IST_OFFSET_MINUTES,
};
