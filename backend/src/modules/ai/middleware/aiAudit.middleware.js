// Attach request-scoped audit metadata. Picked up by the orchestrator and
// logged on AIMetric. Lightweight — no I/O here.

const crypto = require("crypto");

function aiAudit(req, _res, next) {
  req.aiAudit = {
    requestId: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    startTs: Date.now(),
    userAgent: req.headers["user-agent"] || "",
    ip: req.ip || req.headers["x-forwarded-for"] || "",
  };
  next();
}

module.exports = aiAudit;
