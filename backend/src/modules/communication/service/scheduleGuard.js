/**
 * scheduleGuard — enforcement helpers for CommSettings.scheduling (quiet-hours
 * window) and CommSettings.rateLimit. Pure logic so both the mail and whatsapp
 * queue processors can share it.
 *
 * Quiet-hours are evaluated in IST (Asia/Kolkata) — the window is a wall-clock
 * concept for an India-based business, so it must not depend on the server's
 * timezone. Rate limits use rolling windows (last 60 min / last 24 h), which are
 * timezone-agnostic.
 */

// Hour (0-23) and weekday short name in IST, regardless of server TZ.
const istNow = (now) => {
  const hourStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false,
  }).format(now);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata", weekday: "short",
  }).format(now);
  return { hour: parseInt(hourStr, 10) % 24, weekday };
};

/**
 * windowAllowsNow — may we send right now under the scheduling window?
 * Disabled / missing scheduling → always allowed.
 */
const windowAllowsNow = (scheduling, now = new Date()) => {
  if (!scheduling || !scheduling.enabled) return true;

  const { hour, weekday } = istNow(now);

  if (!scheduling.weekendsAllowed && (weekday === "Sat" || weekday === "Sun")) return false;

  const start = Number(scheduling.allowedHoursStart);
  const end   = Number(scheduling.allowedHoursEnd);
  if (Number.isNaN(start) || Number.isNaN(end)) return true; // misconfigured → don't block

  // Normal window (start < end): [start, end). Overnight window (start >= end)
  // wraps midnight, e.g. 20→6 means 20:00–05:59.
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
};

/** rateWindows — rolling-window lower bounds for counting recent sends. */
const rateWindows = (now = new Date()) => ({
  hourAgo: new Date(now.getTime() - 60 * 60 * 1000),
  dayAgo:  new Date(now.getTime() - 24 * 60 * 60 * 1000),
});

/**
 * remainingRate — how many more sends are allowed this tick.
 * Disabled / missing rateLimit → Infinity.
 */
const remainingRate = (rateLimit, hourCount, dayCount) => {
  if (!rateLimit || !rateLimit.enabled) return Infinity;
  const perHour = Number(rateLimit.maxPerHour);
  const perDay  = Number(rateLimit.maxPerDay);
  const hourRemain = Number.isFinite(perHour) ? perHour - hourCount : Infinity;
  const dayRemain  = Number.isFinite(perDay)  ? perDay  - dayCount  : Infinity;
  return Math.max(0, Math.min(hourRemain, dayRemain));
};

module.exports = { windowAllowsNow, rateWindows, remainingRate, istNow };
