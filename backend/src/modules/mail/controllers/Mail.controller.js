const mailService      = require("../service/mail.service");
const mailQueueService = require("../service/mail.queue.service");
const MailLog          = require("../models/MailLog.model");
const { sendMailSchema, scheduleMailSchema } = require("../validator/Mail.validator");

const sendMail = async (req, res) => {
  try {
    const { error, value } = sendMailSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details.map((d) => d.message).join(", ") });

    const result = await mailService.sendImmediate({ ...value, createdBy: req.user._id });
    res.status(200).json({ message: "Mail sent successfully", data: result });
  } catch (err) {
    console.error("[sendMail]", err);
    res.status(500).json({ message: err.message || "Failed to send mail" });
  }
};

const scheduleMail = async (req, res) => {
  try {
    const { error, value } = scheduleMailSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details.map((d) => d.message).join(", ") });

    const job = await mailQueueService.enqueue({ ...value, html: value.html, createdBy: req.user._id });
    res.status(201).json({
      message: "Mail scheduled successfully",
      data: { jobId: job._id, scheduledFor: job.scheduledFor, priority: job.priority },
    });
  } catch (err) {
    console.error("[scheduleMail]", err);
    res.status(500).json({ message: err.message || "Failed to schedule mail" });
  }
};

const getMailLogs = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, recordId } = req.query;
    const query = {};
    if (status)   query.status = status;
    if (recordId) query["relatedTo.recordId"] = recordId;

    const [logs, total] = await Promise.all([
      MailLog.find(query)
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .populate("createdBy", "name email")
        .lean(),
      MailLog.countDocuments(query),
    ]);

    res.status(200).json({
      message: "Mail logs fetched",
      data: { logs, total, page: Number(page), count: logs.length },
    });
  } catch (err) {
    console.error("[getMailLogs]", err);
    res.status(500).json({ message: err.message });
  }
};

const getMailQueue = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const result = await mailQueueService.getQueue({ status, page: Number(page), limit: Number(limit) });
    res.status(200).json({ message: "Mail queue fetched", data: result });
  } catch (err) {
    console.error("[getMailQueue]", err);
    res.status(500).json({ message: err.message });
  }
};

const cancelMailJob = async (req, res) => {
  try {
    const job = await mailQueueService.cancel(req.params.id);
    if (!job) return res.status(404).json({ message: "Queue job not found" });
    res.status(200).json({ message: "Mail job cancelled", data: job });
  } catch (err) {
    console.error("[cancelMailJob]", err);
    res.status(400).json({ message: err.message });
  }
};

module.exports = { sendMail, scheduleMail, getMailLogs, getMailQueue, cancelMailJob };
