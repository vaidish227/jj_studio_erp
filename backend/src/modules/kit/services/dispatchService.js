/**
 * dispatchService — the bridge from KIT orchestration to the existing delivery
 * plane. Given a template + a target entity, it resolves variables, renders the
 * message, enqueues it on the existing mail / whatsapp queues, and records a
 * KitMessageLog for the timeline.
 *
 * It never sends directly — it enqueues, so the existing per-minute queue
 * processors handle provider calls, retries, and the underlying *Log rows.
 */
const KitTemplate   = require("../models/KitTemplate.model");
const KitMessageLog = require("../models/KitMessageLog.model");
const variableResolver = require("./variableResolver");
const mailQueue     = require("../../mail/service/mail.queue.service");
const whatsappQueue = require("../../whatsapp/service/whatsapp.queue.service");
const { wrapEmailHtml } = require("../../mail/service/emailLayout");
const { resolveEmailDesign } = require("./emailDesignService");
const s3 = require("../../pms/services/s3Storage");

/**
 * dispatch — render + enqueue one message for one entity.
 *
 * @param {Object} opts
 * @param {String} opts.entityType  lead|client|project|proposal
 * @param {ObjectId} opts.entityId
 * @param {ObjectId} opts.templateId
 * @param {String} [opts.channel]   overrides template.channel if given
 * @param {ObjectId} [opts.campaignId]
 * @param {ObjectId} [opts.workflowId]
 * @param {ObjectId} [opts.enrollmentId]
 * @param {ObjectId} [opts.createdBy]
 * @returns {Promise<KitMessageLog>}  the message log (status queued|failed)
 */
const dispatch = async (opts) => {
  const { entityType, entityId, templateId, campaignId, workflowId, enrollmentId, createdBy } = opts;

  const template = await KitTemplate.findById(templateId).lean();
  if (!template) throw new Error("KIT template not found");
  const channel = opts.channel || template.channel;

  // Resolve + render.
  const vars    = await variableResolver.resolve(entityType, entityId);
  const contact = await variableResolver.resolveContact(entityType, entityId);
  const render  = (t) => (t ? variableResolver.render(t, vars) : undefined);

  const logBase = {
    entityType, entityId, channel,
    templateId, campaignId, workflowId, enrollmentId, createdBy,
  };

  // Helper to persist a failure log and return it (no throw — caller treats a
  // missing recipient as a handled, logged outcome, not a retryable error).
  const fail = (to, error) =>
    KitMessageLog.create({ ...logBase, to, status: "failed", error });

  const relatedTo = { module: "kit", recordId: entityId };

  if (channel === "email") {
    if (!contact.email) return fail(undefined, "No email address for recipient");
    const message = render(template.htmlBody) || "";
    const design  = await resolveEmailDesign(template.emailDesign); // global brand < this template's overrides
    await mailQueue.enqueue({
      to:       contact.email,
      subject:  render(template.subject) || "",
      html:     wrapEmailHtml(message, design),  // author writes the body; backend wraps it in the branded frame
      text:     render(template.textBody) || message,
      relatedTo, createdBy,
    });
    return KitMessageLog.create({ ...logBase, to: contact.email, status: "queued", providerLogRef: "MailLog" });
  }

  if (channel === "whatsapp") {
    if (!contact.phone) return fail(undefined, "No phone number for recipient");
    const text = render(template.body) || "";

    // Collect attachments (new array, else legacy single-media), preserving order.
    let atts = [];
    if (Array.isArray(template.attachments) && template.attachments.length) {
      atts = template.attachments.filter((a) => a && (a.url || a.key)).map((a) => ({ kind: a.kind || "document", url: a.url, key: a.key }));
    } else if (template.mediaType && template.mediaType !== "none" && (template.mediaKey || template.mediaUrl)) {
      atts = [{ kind: template.mediaType, url: template.mediaUrl, key: template.mediaKey }];
    }

    // Text as its own message so it's never lost behind media (the provider
    // replaces the text with the media URL when both are on one message).
    if (text.trim() || atts.length === 0) {
      await whatsappQueue.enqueue({ to: contact.phone, message: text, relatedTo, createdBy });
    }
    // Each attachment as its own message, in order, with a freshly-signed URL.
    for (const a of atts) {
      let url = a.url || undefined;
      if (a.key && s3.isConfigured()) {
        try { url = await s3.getSignedDownloadUrl({ key: a.key, expiresIn: 24 * 3600, disposition: "inline" }); }
        catch (e) { console.error("[kit.dispatch] media sign failed:", e.message); }
      }
      if (!url) continue;
      await whatsappQueue.enqueue({ to: contact.phone, message: "", mediaUrl: url, mediaType: a.kind || "document", relatedTo, createdBy });
    }
    return KitMessageLog.create({ ...logBase, to: contact.phone, status: "queued", providerLogRef: "WhatsAppLog" });
  }

  // Notification channel: campaigns target external contacts, but in-app
  // notifications address internal users — that mapping arrives in a later
  // phase. Record a clear, non-retryable failure for now.
  return fail(undefined, "Notification channel not yet supported for campaign dispatch");
};

module.exports = { dispatch };
