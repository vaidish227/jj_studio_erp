const cron         = require("node-cron");
const MailQueue    = require("../models/MailQueue.model");
const MailLog      = require("../models/MailLog.model");
const MailTemplate = require("../models/MailTemplate.model");
const { renderTemplate, getSettings, getProvider, getProviderConfig } = require("../service/mail.service");
const scheduleGuard = require("../../communication/service/scheduleGuard");

// ─── Exponential backoff: 5 min, 15 min, 45 min ──────────────────────────────
const retryDelayMs = (retryCount) => Math.pow(3, retryCount) * 5 * 60 * 1000;

const processJob = async (job, settings) => {
  const provider = getProvider(settings.activeProvider);
  const config   = getProviderConfig(settings, settings.activeProvider);

  let finalHtml    = job.htmlBody;
  let finalSubject = job.subject;

  if (job.templateId) {
    const tmpl = await MailTemplate.findById(job.templateId);
    if (tmpl) {
      finalHtml    = renderTemplate(tmpl.htmlBody, job.templateVariables || {});
      finalSubject = job.subject || renderTemplate(tmpl.subject, job.templateVariables || {});
    }
  }

  const result = await provider.send({
    to: job.to, cc: job.cc, bcc: job.bcc,
    subject: finalSubject,
    html:    finalHtml,
    text:    job.textBody,
    config,
  });

  await MailLog.create({
    templateId: job.templateId,
    to: job.to, cc: job.cc, bcc: job.bcc,
    subject:    finalSubject,
    htmlBody:   finalHtml,
    status:     "sent",
    provider:   settings.activeProvider,
    messageId:  result.messageId,
    sentAt:     new Date(),
    relatedTo:  job.relatedTo,
    createdBy:  job.createdBy,
  });

  await MailQueue.findByIdAndUpdate(job._id, { status: "sent", processedAt: new Date() });
};

const processMailQueue = async () => {
  try {
    const settings  = await getSettings();
    if (!settings.queue?.enabled) return;

    const batchSize = settings.queue?.batchSize || 10;
    const now       = new Date();

    // Phase 5 — quiet-hours window: skip this tick entirely if outside the
    // allowed window. Jobs stay pending and flow once the window opens.
    if (!scheduleGuard.windowAllowsNow(settings.scheduling, now)) return;

    // Phase 5 — rate limit: cap this tick to the remaining hourly/daily budget.
    let effectiveBatch = batchSize;
    if (settings.rateLimit?.enabled) {
      const { hourAgo, dayAgo } = scheduleGuard.rateWindows(now);
      const [hourCount, dayCount] = await Promise.all([
        MailLog.countDocuments({ status: "sent", createdAt: { $gte: hourAgo } }),
        MailLog.countDocuments({ status: "sent", createdAt: { $gte: dayAgo } }),
      ]);
      const remaining = scheduleGuard.remainingRate(settings.rateLimit, hourCount, dayCount);
      if (remaining <= 0) return;
      effectiveBatch = Math.min(batchSize, remaining);
    }

    for (let i = 0; i < effectiveBatch; i++) {
      // Atomically claim one pending job — prevents double-processing
      const job = await MailQueue.findOneAndUpdate(
        {
          status:       "pending",
          scheduledFor: { $lte: now },
          $expr:        { $lt: ["$retryCount", "$maxRetries"] },
        },
        { $set: { status: "processing", lastAttemptAt: now } },
        { new: true, sort: { priority: -1, scheduledFor: 1 } }
      );

      if (!job) break;

      try {
        await processJob(job, settings);
      } catch (err) {
        const nextRetry  = job.retryCount + 1;
        const isFinal    = nextRetry >= job.maxRetries;
        const nextFireAt = isFinal ? undefined : new Date(Date.now() + retryDelayMs(nextRetry));

        await MailQueue.findByIdAndUpdate(job._id, {
          status:       isFinal ? "failed" : "pending",
          retryCount:   nextRetry,
          lastError:    err.message,
          lastAttemptAt: now,
          ...(nextFireAt ? { scheduledFor: nextFireAt } : {}),
        });

        console.error(`[MailQueue] Job ${job._id} failed (attempt ${nextRetry}/${job.maxRetries}):`, err.message);
      }
    }
  } catch (err) {
    console.error("[MailQueue] Processor error:", err.message);
  }
};

const startMailQueueProcessor = () => {
  cron.schedule("* * * * *", processMailQueue);
  console.log("[MailQueue] Processor started — runs every minute");
};

module.exports = { startMailQueueProcessor, processMailQueue };
