// Per-user, per-minute rate limiter for the AI chat endpoint.
// In-memory Map → resets each rolling minute. Sufficient until the deployment
// scales to multiple Node processes; at that point swap for Redis. Until then
// we accept a small over-budget window across replicas.

const aiConfig = require("../config/aiConfig");

const buckets = new Map(); // userId -> { count, windowStart }
const WINDOW_MS = 60_000;

function aiRateLimit(req, res, next) {
  const userId = String(req.user?.id || "anon");
  const now = Date.now();

  let b = buckets.get(userId);
  if (!b || now - b.windowStart >= WINDOW_MS) {
    b = { count: 0, windowStart: now };
    buckets.set(userId, b);
  }

  if (b.count >= aiConfig.limits.rateLimitPerMin) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - b.windowStart)) / 1000);
    res.setHeader("Retry-After", String(retryAfter));
    return res.status(429).json({
      message: `Rate limit exceeded. Try again in ${retryAfter}s.`,
      code: "rate_limit_exceeded",
    });
  }

  b.count++;
  next();
}

// Internal — exposed for testing / metrics
function _getBucket(userId) { return buckets.get(String(userId)) || null; }

module.exports = aiRateLimit;
module.exports._getBucket = _getBucket;
