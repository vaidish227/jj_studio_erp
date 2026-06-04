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
    await mailQueue.enqueue({
      to:       contact.email,
      subject:  render(template.subject) || "",
      html:     render(template.htmlBody),
      text:     render(template.textBody),
      relatedTo, createdBy,
    });
    return KitMessageLog.create({ ...logBase, to: contact.email, status: "queued", providerLogRef: "MailLog" });
  }

  if (channel === "whatsapp") {
    if (!contact.phone) return fail(undefined, "No phone number for recipient");
    await whatsappQueue.enqueue({
      to:        contact.phone,
      message:   render(template.body) || "",
      mediaUrl:  template.mediaUrl || undefined,
      mediaType: template.mediaType || "none",
      relatedTo, createdBy,
    });
    return KitMessageLog.create({ ...logBase, to: contact.phone, status: "queued", providerLogRef: "WhatsAppLog" });
  }

  // Notification channel: campaigns target external contacts, but in-app
  // notifications address internal users — that mapping arrives in a later
  // phase. Record a clear, non-retryable failure for now.
  return fail(undefined, "Notification channel not yet supported for campaign dispatch");
};

module.exports = { dispatch };
