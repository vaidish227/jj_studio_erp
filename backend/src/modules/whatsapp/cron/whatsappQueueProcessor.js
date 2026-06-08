const cron              = require("node-cron");
const WhatsAppQueue     = require("../models/WhatsAppQueue.model");
const WhatsAppLog       = require("../models/WhatsAppLog.model");
const WhatsAppTemplate  = require("../models/WhatsAppTemplate.model");
const { renderTemplate, getSettings, getProvider, getProviderConfig } = require("../service/whatsapp.service");
const scheduleGuard = require("../../communication/service/scheduleGuard");

const retryDelayMs = (retryCount) => Math.pow(3, retryCount) * 5 * 60 * 1000;

const processJob = async (job, settings) => {
  const provider = getProvider(settings.activeProvider);
  const config   = getProviderConfig(settings, settings.activeProvider);

  let finalMessage = job.message;
  let mediaUrl     = job.mediaUrl;
  let mediaType    = job.mediaType || "none";

  if (job.templateId) {
    const tmpl = await WhatsAppTemplate.findById(job.templateId);
    if (tmpl) {
      finalMessage = renderTemplate(tmpl.body, job.templateVariables || {});
      if (!mediaUrl && tmpl.mediaUrl) {
        mediaUrl  = tmpl.mediaUrl;
        mediaType = tmpl.mediaType || "none";
      }
    }
  }

  if (!finalMessage) throw new Error("Message body is empty — check template or message field");

  const result = await provider.send({
    to: job.to,
    message: finalMessage,
    mediaUrl,
    mediaType,
    config,
  });

  await WhatsAppLog.create({
    templateId: job.templateId,
    to:         job.to,
    message:    finalMessage,
    mediaUrl,
    mediaType,
    status:     "sent",
    provider:   settings.activeProvider,
    messageId:  result.messageId,
    sentAt:     new Date(),
    relatedTo:  job.relatedTo,
    createdBy:  job.createdBy,
  });

  await WhatsAppQueue.findByIdAndUpdate(job._id, { status: "sent", processedAt: new Date() });
};

const processWhatsAppQueue = async () => {
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
        WhatsAppLog.countDocuments({ status: "sent", createdAt: { $gte: hourAgo } }),
        WhatsAppLog.countDocuments({ status: "sent", createdAt: { $gte: dayAgo } }),
      ]);
      const remaining = scheduleGuard.remainingRate(settings.rateLimit, hourCount, dayCount);
      if (remaining <= 0) return;
      effectiveBatch = Math.min(batchSize, remaining);
    }

    for (let i = 0; i < effectiveBatch; i++) {
      const job = await WhatsAppQueue.findOneAndUpdate(
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

        await WhatsAppQueue.findByIdAndUpdate(job._id, {
          status:       isFinal ? "failed" : "pending",
          retryCount:   nextRetry,
          lastError:    err.message,
          lastAttemptAt: now,
          ...(nextFireAt ? { scheduledFor: nextFireAt } : {}),
        });

        console.error(`[WhatsAppQueue] Job ${job._id} failed (attempt ${nextRetry}/${job.maxRetries}):`, err.message);
      }
    }
  } catch (err) {
    console.error("[WhatsAppQueue] Processor error:", err.message);
  }
};

const startWhatsAppQueueProcessor = () => {
  cron.schedule("* * * * *", processWhatsAppQueue);
  console.log("[WhatsAppQueue] Processor started — runs every minute");
};

module.exports = { startWhatsAppQueueProcessor, processWhatsAppQueue };
