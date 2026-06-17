/**
 * Manual / framework-agnostic test runner for resolveDateRange.
 *
 *   Run:  node backend/src/modules/dashboard/utils/resolveDateRange.test.js
 *
 * Uses Node's built-in `assert` only — no Jest/Mocha needed. A fixed injected
 * "now" (2026-06-16 08:30 IST = 2026-06-16T03:00:00Z) makes every expectation
 * deterministic. All expected values are expressed as UTC ISO strings; recall
 * IST = UTC+05:30, so an IST midnight is the previous day at 18:30:00.000Z.
 */

'use strict';

const assert = require('assert');
const { resolveDateRange, DateRangeError, PRESETS } = require('./resolveDateRange');

const NOW = new Date('2026-06-16T03:00:00.000Z'); // 2026-06-16 08:30 IST (a Tuesday)
const at = { now: NOW };

let passed = 0;
function check(name, actual, expected) {
  assert.strictEqual(actual, expected, `${name}\n  expected: ${expected}\n  actual:   ${actual}`);
  passed += 1;
}
function iso(d) { return d.toISOString(); }

// ── 1. today ────────────────────────────────────────────────────────────────
{
  const r = resolveDateRange({ preset: 'today' }, at);
  check('today.start',     iso(r.start),     '2026-06-15T18:30:00.000Z'); // IST 06-16 00:00
  check('today.end',       iso(r.end),       '2026-06-16T18:29:59.999Z'); // IST 06-16 23:59:59.999
  check('today.prevStart', iso(r.prevStart), '2026-06-14T18:30:00.000Z'); // IST 06-15 00:00
  check('today.prevEnd',   iso(r.prevEnd),   '2026-06-15T18:29:59.999Z'); // IST 06-15 23:59:59.999
  check('today.preset',    r.preset,         'today');
}

// ── 2. yesterday ─────────────────────────────────────────────────────────────
{
  const r = resolveDateRange({ preset: 'yesterday' }, at);
  check('yesterday.start',     iso(r.start),     '2026-06-14T18:30:00.000Z'); // IST 06-15 00:00
  check('yesterday.end',       iso(r.end),       '2026-06-15T18:29:59.999Z'); // IST 06-15 23:59:59.999
  check('yesterday.prevStart', iso(r.prevStart), '2026-06-13T18:30:00.000Z'); // IST 06-14 00:00
  check('yesterday.prevEnd',   iso(r.prevEnd),   '2026-06-14T18:29:59.999Z');
}

// ── 3. last_7_days (today + 6 prior, inclusive) ─────────────────────────────
{
  const r = resolveDateRange({ preset: 'last_7_days' }, at);
  check('last_7_days.start',     iso(r.start),     '2026-06-09T18:30:00.000Z'); // IST 06-10 00:00
  check('last_7_days.end',       iso(r.end),       '2026-06-16T18:29:59.999Z'); // IST 06-16 23:59:59.999
  check('last_7_days.prevStart', iso(r.prevStart), '2026-06-02T18:30:00.000Z'); // IST 06-03 00:00
  check('last_7_days.prevEnd',   iso(r.prevEnd),   '2026-06-09T18:29:59.999Z'); // IST 06-09 23:59:59.999
}

// ── 4. last_30_days (today + 29 prior, inclusive) ───────────────────────────
{
  const r = resolveDateRange({ preset: 'last_30_days' }, at);
  check('last_30_days.start',     iso(r.start),     '2026-05-17T18:30:00.000Z'); // IST 05-18 00:00
  check('last_30_days.end',       iso(r.end),       '2026-06-16T18:29:59.999Z');
  check('last_30_days.prevStart', iso(r.prevStart), '2026-04-17T18:30:00.000Z'); // IST 04-18 00:00
  check('last_30_days.prevEnd',   iso(r.prevEnd),   '2026-05-17T18:29:59.999Z');
}

// ── 4b. last_90_days (today + 89 prior, inclusive) ──────────────────────────
{
  const r = resolveDateRange({ preset: 'last_90_days' }, at);
  check('last_90_days.start',     iso(r.start),     '2026-03-18T18:30:00.000Z'); // IST 03-19 00:00
  check('last_90_days.end',       iso(r.end),       '2026-06-16T18:29:59.999Z');
  check('last_90_days.prevStart', iso(r.prevStart), '2025-12-18T18:30:00.000Z'); // IST 2025-12-19 00:00
  check('last_90_days.prevEnd',   iso(r.prevEnd),   '2026-03-18T18:29:59.999Z');
}

// ── 4c. all_time (epoch → end of today; effectively unbounded) ──────────────
{
  const r = resolveDateRange({ preset: 'all_time' }, at);
  check('all_time.start', iso(r.start), '1970-01-01T00:00:00.000Z'); // epoch
  check('all_time.end',   iso(r.end),   '2026-06-16T18:29:59.999Z'); // IST end of today
}

// ── 5. this_month (month-to-date); prev = equal-length span before the 1st ───
{
  const r = resolveDateRange({ preset: 'this_month' }, at);
  check('this_month.start',     iso(r.start),     '2026-05-31T18:30:00.000Z'); // IST 06-01 00:00
  check('this_month.end',       iso(r.end),       '2026-06-16T18:29:59.999Z'); // 16 days (month-to-date)
  check('this_month.prevStart', iso(r.prevStart), '2026-05-15T18:30:00.000Z'); // IST 05-16 00:00 (16-day span)
  check('this_month.prevEnd',   iso(r.prevEnd),   '2026-05-31T18:29:59.999Z');
}

// ── 6. last_month (full previous calendar month = May 2026) ──────────────────
{
  const r = resolveDateRange({ preset: 'last_month' }, at);
  check('last_month.start',     iso(r.start),     '2026-04-30T18:30:00.000Z'); // IST 05-01 00:00
  check('last_month.end',       iso(r.end),       '2026-05-31T18:29:59.999Z'); // IST 05-31 23:59:59.999
  check('last_month.prevStart', iso(r.prevStart), '2026-03-30T18:30:00.000Z'); // IST 03-31 00:00 (31-day span)
  check('last_month.prevEnd',   iso(r.prevEnd),   '2026-04-30T18:29:59.999Z');
}

// ── 7. custom range ──────────────────────────────────────────────────────────
{
  const r = resolveDateRange({ from: '2026-06-01', to: '2026-06-15' }, at);
  check('custom.preset',    r.preset,         'custom'); // inferred from from/to
  check('custom.start',     iso(r.start),     '2026-05-31T18:30:00.000Z'); // IST 06-01 00:00
  check('custom.end',       iso(r.end),       '2026-06-15T18:29:59.999Z'); // IST 06-15 23:59:59.999 (inclusive)
  check('custom.prevStart', iso(r.prevStart), '2026-05-16T18:30:00.000Z'); // IST 05-17 00:00 (15-day span)
  check('custom.prevEnd',   iso(r.prevEnd),   '2026-05-31T18:29:59.999Z');
}

// ── 8. single-day custom (from === to) is valid ──────────────────────────────
{
  const r = resolveDateRange({ from: '2026-06-16', to: '2026-06-16' }, at);
  check('custom-1day.start', iso(r.start), '2026-06-15T18:30:00.000Z');
  check('custom-1day.end',   iso(r.end),   '2026-06-16T18:29:59.999Z');
}

// ── 9. validation errors ─────────────────────────────────────────────────────
function expectError(name, code, fn) {
  try {
    fn();
    assert.fail(`${name}: expected DateRangeError(${code}) but none was thrown`);
  } catch (err) {
    assert.ok(err instanceof DateRangeError, `${name}: expected DateRangeError, got ${err.name}`);
    assert.strictEqual(err.code, code, `${name}: expected code ${code}, got ${err.code}`);
    passed += 1;
  }
}

expectError('unknown preset',   'UNKNOWN_PRESET', () => resolveDateRange({ preset: 'last_year' }, at));
expectError('no input',         'MISSING_PRESET', () => resolveDateRange({}, at));
expectError('custom missing to','MISSING_RANGE',  () => resolveDateRange({ from: '2026-06-01' }, at));
expectError('custom missing from','MISSING_RANGE',() => resolveDateRange({ preset: 'custom', to: '2026-06-01' }, at));
expectError('bad date format',  'INVALID_DATE',   () => resolveDateRange({ from: '06/01/2026', to: '2026-06-15' }, at));
expectError('impossible date',  'INVALID_DATE',   () => resolveDateRange({ from: '2026-02-30', to: '2026-03-01' }, at));
expectError('to before from',   'INVALID_RANGE',  () => resolveDateRange({ from: '2026-06-15', to: '2026-06-01' }, at));

// ── 10. sanity: every preset returns 4 ordered Date instants ─────────────────
for (const p of PRESETS.filter((x) => x !== 'custom')) {
  const r = resolveDateRange({ preset: p }, at);
  assert.ok(r.start instanceof Date && r.end instanceof Date, `${p}: start/end are Dates`);
  assert.ok(r.end.getTime() >= r.start.getTime(), `${p}: end >= start`);
  assert.ok(r.prevEnd.getTime() < r.start.getTime(), `${p}: prevEnd precedes start`);
  assert.ok(r.prevStart.getTime() <= r.prevEnd.getTime(), `${p}: prevStart <= prevEnd`);
  // previous window duration equals current window duration
  const cur = r.end.getTime() - r.start.getTime();
  const prev = r.prevEnd.getTime() - r.prevStart.getTime();
  assert.strictEqual(prev, cur, `${p}: prev window duration matches current`);
  passed += 1;
}

console.log(`✓ resolveDateRange — all ${passed} assertions passed.`);
