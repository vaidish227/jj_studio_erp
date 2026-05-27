const WhatsAppQueue = require("../models/WhatsAppQueue.model");

const enqueue = async ({
  to, message,
  templateId, templateVariables,
  mediaUrl, mediaType = "none",
  scheduledFor, priority = "normal", maxRetries = 3,
  relatedTo, createdBy,
}) => {
  const fireAt = scheduledFor ? new Date(scheduledFor) : new Date();
  const type   = fireAt > new Date() ? "scheduled" : "immediate";

  return await WhatsAppQueue.create({
    type,
    status:       "pending",
    priority,
    scheduledFor: fireAt,
    to,
    message,
    mediaUrl,
    mediaType,
    templateId:   templateId || undefined,
    templateVariables,
    maxRetries,
    relatedTo,
    createdBy,
  });
};

const cancel = async (jobId) => {
  const job = await WhatsAppQueue.findById(jobId);
  if (!job) return null;
  if (job.status !== "pending") throw new Error("Only pending jobs can be cancelled");
  job.status = "cancelled";
  await job.save();
  return job;
};

const getQueue = async ({ status, page = 1, limit = 20 } = {}) => {
  const query = {};
  if (status) query.status = status;

  const [jobs, total] = await Promise.all([
    WhatsAppQueue.find(query)
      .sort({ scheduledFor: -1 })
      .skip((page - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean(),
    WhatsAppQueue.countDocuments(query),
  ]);

  return { jobs, total, page: Number(page), count: jobs.length };
};

module.exports = { enqueue, cancel, getQueue };
