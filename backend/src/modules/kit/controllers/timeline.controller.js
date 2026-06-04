const mongoose = require("mongoose");
const MailLog       = require("../../mail/models/MailLog.model");
const WhatsAppLog   = require("../../whatsapp/models/WhatsAppLog.model");
const Notification  = require("../../notifications/models/Notification.model");
const KitMessageLog = require("../models/KitMessageLog.model");
const { ENTITY_TYPES } = require("../constants/enums");

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// Strip HTML + collapse whitespace into a short preview snippet.
const snippet = (s = "", n = 160) =>
  String(s).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, n);

/**
 * GET /api/kit/timeline/:entityType/:entityId
 *
 * Unified communication history for one entity, merged from the real delivery
 * audit logs (the source of truth for Sent/Delivered/Read/Failed) plus KIT-side
 * failures that never reached a queue (e.g. missing recipient). Sorted newest
 * first. Items originating from KIT carry module === "kit".
 */
const getTimeline = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    if (!ENTITY_TYPES.includes(entityType)) return res.status(400).json({ message: "Invalid entityType" });
    if (!isValidId(entityId)) return res.status(400).json({ message: "Invalid entityId" });

    const oid = new mongoose.Types.ObjectId(entityId);
    const limit = Math.min(parseInt(req.query.limit) || 100, 300);

    const [mails, whatsapps, notifications, kitFailures] = await Promise.all([
      MailLog.find({ "relatedTo.recordId": oid }).sort({ createdAt: -1 }).limit(limit).lean(),
      WhatsAppLog.find({ "relatedTo.recordId": oid }).sort({ createdAt: -1 }).limit(limit).lean(),
      Notification.find({ "relatedTo.recordId": oid }).sort({ createdAt: -1 }).limit(limit).lean(),
      // KIT-side failures never produce a provider log — surface them explicitly.
      KitMessageLog.find({ entityType, entityId: oid, status: "failed" }).sort({ createdAt: -1 }).limit(limit).lean(),
    ]);

    const items = [
      ...mails.map((m) => ({
        id: String(m._id), source: "MailLog", channel: "email",
        status: m.status, to: Array.isArray(m.to) ? m.to[0] : m.to,
        title: m.subject, preview: snippet(m.htmlBody || m.textBody),
        module: m.relatedTo?.module, error: m.failureReason,
        at: m.sentAt || m.createdAt,
      })),
      ...whatsapps.map((w) => ({
        id: String(w._id), source: "WhatsAppLog", channel: "whatsapp",
        status: w.status, to: w.to,
        title: null, preview: snippet(w.message),
        module: w.relatedTo?.module, error: w.failureReason,
        at: w.sentAt || w.createdAt,
      })),
      ...notifications.map((n) => ({
        id: String(n._id), source: "Notification", channel: "notification",
        status: n.readAt ? "read" : "sent", to: null,
        title: n.title, preview: snippet(n.message),
        module: n.relatedTo?.module || n.module, error: null,
        at: n.createdAt,
      })),
      ...kitFailures.map((k) => ({
        id: String(k._id), source: "KitMessageLog", channel: k.channel,
        status: "failed", to: k.to,
        title: null, preview: null,
        module: "kit", error: k.error,
        at: k.createdAt,
      })),
    ];

    items.sort((a, b) => new Date(b.at) - new Date(a.at));

    res.status(200).json({ message: "Timeline fetched", data: { items: items.slice(0, limit), total: items.length } });
  } catch (err) {
    console.error("[kit.getTimeline]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/kit/messages?entityType&entityId&channel&status&campaignId
 * Raw KIT message-log query (campaign/workflow-attributed sends).
 */
const getMessages = async (req, res) => {
  try {
    const { entityType, entityId, channel, status, campaignId, workflowId, page = 1, limit = 50 } = req.query;
    const query = {};
    if (entityType) query.entityType = entityType;
    if (entityId && isValidId(entityId)) query.entityId = entityId;
    if (channel)    query.channel = channel;
    if (status)     query.status = status;
    if (campaignId && isValidId(campaignId)) query.campaignId = campaignId;
    if (workflowId && isValidId(workflowId)) query.workflowId = workflowId;

    const [messages, total] = await Promise.all([
      KitMessageLog.find(query)
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .populate("templateId", "name channel")
        .populate("campaignId", "name")
        .lean(),
      KitMessageLog.countDocuments(query),
    ]);

    res.status(200).json({ message: "Messages fetched", data: { messages, total } });
  } catch (err) {
    console.error("[kit.getMessages]", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getTimeline, getMessages };
