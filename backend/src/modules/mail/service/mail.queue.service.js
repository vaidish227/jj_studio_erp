const MailQueue = require("../models/MailQueue.model");

const enqueue = async ({
  to, cc, bcc, subject, html, text,
  templateId, templateVariables,
  scheduledFor, priority = "normal", maxRetries = 3,
  relatedTo, createdBy,
}) => {
  const fireAt = scheduledFor ? new Date(scheduledFor) : new Date();
  const type   = fireAt > new Date() ? "scheduled" : "immediate";

  return await MailQueue.create({
    type,
    status:       "pending",
    priority,
    scheduledFor: fireAt,
    to:           Array.isArray(to) ? to : [to],
    cc,
    bcc,
    subject,
    htmlBody:     html,
    textBody:     text,
    templateId:   templateId || undefined,
    templateVariables,
    maxRetries,
    relatedTo,
    createdBy,
  });
};

const cancel = async (jobId) => {
  const job = await MailQueue.findById(jobId);
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
    MailQueue.find(query)
      .sort({ scheduledFor: -1 })
      .skip((page - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean(),
    MailQueue.countDocuments(query),
  ]);

  return { jobs, total, page: Number(page), count: jobs.length };
};

module.exports = { enqueue, cancel, getQueue };
