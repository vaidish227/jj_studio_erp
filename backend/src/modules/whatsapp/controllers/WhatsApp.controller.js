const whatsappService      = require("../service/whatsapp.service");
const whatsappQueueService = require("../service/whatsapp.queue.service");
const WhatsAppLog          = require("../models/WhatsAppLog.model");
const { sendMessageSchema, scheduleMessageSchema } = require("../validator/WhatsApp.validator");

const sendMessage = async (req, res) => {
  try {
    const { error, value } = sendMessageSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details.map((d) => d.message).join(", ") });

    const result = await whatsappService.sendImmediate({ ...value, createdBy: req.user._id });
    res.status(200).json({ message: "WhatsApp message sent successfully", data: result });
  } catch (err) {
    console.error("[sendWhatsApp]", err);
    res.status(500).json({ message: err.message || "Failed to send WhatsApp message" });
  }
};

const scheduleMessage = async (req, res) => {
  try {
    const { error, value } = scheduleMessageSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details.map((d) => d.message).join(", ") });

    const job = await whatsappQueueService.enqueue({ ...value, createdBy: req.user._id });
    res.status(201).json({
      message: "WhatsApp message scheduled successfully",
      data: { jobId: job._id, scheduledFor: job.scheduledFor, priority: job.priority },
    });
  } catch (err) {
    console.error("[scheduleWhatsApp]", err);
    res.status(500).json({ message: err.message || "Failed to schedule WhatsApp message" });
  }
};

const getLogs = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, recordId, to } = req.query;
    const query = {};
    if (status)   query.status = status;
    if (recordId) query["relatedTo.recordId"] = recordId;
    if (to)       query.to = { $regex: to, $options: "i" };

    const [logs, total] = await Promise.all([
      WhatsAppLog.find(query)
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .populate("createdBy", "name email")
        .lean(),
      WhatsAppLog.countDocuments(query),
    ]);

    res.status(200).json({
      message: "WhatsApp logs fetched",
      data: { logs, total, page: Number(page), count: logs.length },
    });
  } catch (err) {
    console.error("[getWhatsAppLogs]", err);
    res.status(500).json({ message: err.message });
  }
};

const getQueue = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const result = await whatsappQueueService.getQueue({ status, page: Number(page), limit: Number(limit) });
    res.status(200).json({ message: "WhatsApp queue fetched", data: result });
  } catch (err) {
    console.error("[getWhatsAppQueue]", err);
    res.status(500).json({ message: err.message });
  }
};

const cancelJob = async (req, res) => {
  try {
    const job = await whatsappQueueService.cancel(req.params.id);
    if (!job) return res.status(404).json({ message: "Queue job not found" });
    res.status(200).json({ message: "WhatsApp job cancelled", data: job });
  } catch (err) {
    console.error("[cancelWhatsAppJob]", err);
    res.status(400).json({ message: err.message });
  }
};

// Backward-compatible alias: POST /api/whatsapp/send-lead-message (used by old whatspp module)
const sendLeadMessage = async (req, res) => {
  try {
    const { phone, clientName } = req.body;
    if (!phone)      return res.status(400).json({ message: "phone is required" });
    if (!clientName) return res.status(400).json({ message: "clientName is required" });

    const message = `Hi ${clientName},\n\nThank you for reaching out to JJ Studio by Deepa Bagaria! We're excited to help you with your interior design journey.\n\nWe will be in touch with you shortly. Please feel free to reach out to us with any questions.\n\nWarm regards,\nTeam JJ Studio`;

    const result = await whatsappService.sendImmediate({
      to: phone,
      message,
      relatedTo: { module: "manual" },
      createdBy: req.user?._id,
    });

    res.status(200).json({ message: "WhatsApp sent", data: result });
  } catch (err) {
    console.error("[sendLeadMessage]", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { sendMessage, scheduleMessage, getLogs, getQueue, cancelJob, sendLeadMessage };
