/**
 * thankYouService — fires the automatic post-enquiry thank-you messages to the
 * lead and (when present) the referral person, across WhatsApp + Email.
 *
 * The message content comes INLINE from the ThankYouSettings singleton (managed
 * on one admin screen). This service renders those `{{token}}` strings and
 * enqueues onto the EXISTING mail / whatsapp queues (with `scheduledFor` for the
 * configured delay), so the per-minute processors handle provider calls,
 * retries, quiet-hours and the *Log audit rows. It never sends directly.
 *
 * Every individual send is independently guarded: a missing contact, empty
 * message, or a single channel failure never blocks the other sends, and the
 * whole thing is fire-and-forget so it can never break enquiry creation.
 */
const ThankYouSettings = require("../models/ThankYouSettings.model");
const { renderTemplate } = require("../../mail/service/mail.service");
const mailQueue        = require("../../mail/service/mail.queue.service");
const whatsappQueue    = require("../../whatsapp/service/whatsapp.queue.service");
const { wrapEmailHtml } = require("../../mail/service/emailLayout");
const { resolveEmailDesign } = require("./emailDesignService");

const COMPANY_NAME = process.env.COMPANY_NAME || "JJ Studio";

const firstWord = (s) => (typeof s === "string" ? s.trim().split(/\s+/)[0] : undefined);

/**
 * buildVariables — flat `{{token}}` map for a lead/enquiry + its referral
 * person. Empty values are dropped so unresolved tokens stay intact.
 */
const buildVariables = (client) => {
  const raw = {
    lead_name:       client.name,
    lead_phone:      client.phone,
    lead_email:      client.email,
    client_name:     client.name,
    first_name:      firstWord(client.name),
    phone:           client.phone,
    email:           client.email,
    city:            client.city,
    project_type:    client.projectType,
    enquiry_details: client.notes,

    referral_name:   client.referredBy,
    referral_phone:  client.referrerPhone,
    referral_email:  client.referrerEmail,
    referred_by:     client.referredBy,

    company_name:    COMPANY_NAME,
  };

  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v !== undefined && v !== null && v !== "") out[k] = String(v);
  }
  return out;
};

const render = (t, vars) => (t ? renderTemplate(t, vars) : undefined);

// Best-effort communication-log entry on the client doc (persisted by caller).
const logComm = (client, channel, status, content, subject) => {
  try {
    client.communicationLogs = Array.isArray(client.communicationLogs) ? client.communicationLogs : [];
    client.communicationLogs.push({
      channel, direction: "Outbound", content, subject, status, timestamp: new Date(),
    });
  } catch { /* never block on logging */ }
};

/**
 * sendOne — render + enqueue a single (recipient, channel) message from inline
 * content. Returns "queued" | "skipped" | "failed" and never throws.
 *
 * @param {Object} content  { body } for whatsapp, { subject, body } for email
 */
const sendOne = async ({ client, label, channel, content, to, vars, scheduledFor, createdBy, emailDesign }) => {
  try {
    if (!to) return "skipped";                       // no contact detail for this channel
    const bodyTpl = content && content.body;
    if (!bodyTpl || !String(bodyTpl).trim()) return "skipped"; // no message configured

    const relatedTo = { module: "kit", recordId: client._id };

    if (channel === "email") {
      const subject = render(content.subject, vars) || "Thank you";
      const body    = render(bodyTpl, vars) || "";
      await mailQueue.enqueue({ to, subject, html: wrapEmailHtml(body, emailDesign), text: body, scheduledFor, relatedTo, createdBy });
      logComm(client, "Email", "queued", body, subject);
      return "queued";
    }

    if (channel === "whatsapp") {
      const message = render(bodyTpl, vars) || "";
      await whatsappQueue.enqueue({ to, message, scheduledFor, relatedTo, createdBy });
      logComm(client, "WhatsApp", "queued", message);
      return "queued";
    }

    return "skipped";
  } catch (err) {
    console.error(`[thankYou] ${label} send failed:`, err?.message);
    return "failed";
  }
};

/**
 * triggerThankYou — main entry. Reads settings and, if enabled, queues up to
 * four messages: lead-whatsapp, lead-email, referral-whatsapp, referral-email.
 * Safe to call fire-and-forget; it swallows all its own errors.
 *
 * @param {Object} client  the saved CRMClient mongoose document
 * @param {Object} [actor] req.user (recorded as createdBy on the queued jobs)
 */
const triggerThankYou = async (client, actor) => {
  if (!client) return;

  let settings;
  try {
    settings = await ThankYouSettings.getOrCreateDefaults();
  } catch (err) {
    console.error("[thankYou] could not load settings:", err?.message);
    return;
  }
  if (!settings.enabled) return;

  // Idempotency — never queue twice for the same enquiry.
  if (client.automation && client.automation.thankYouQueuedAt) return;

  const UNIT_MS = { minutes: 60 * 1000, hours: 60 * 60 * 1000, days: 24 * 60 * 60 * 1000 };
  const delayValue = Number(settings.delayValue) || 0;
  const delayUnit  = UNIT_MS[settings.delayUnit] ? settings.delayUnit : "hours";
  const delayMs = delayValue > 0 ? delayValue * UNIT_MS[delayUnit] : 0;
  const scheduledFor = delayMs > 0 ? new Date(Date.now() + delayMs) : new Date();

  const createdBy = actor?._id || actor?.id || undefined;
  const vars = buildVariables(client);
  const ch  = settings.channels   || {};
  const rc  = settings.recipients || {};
  const msg = settings.messages   || {};

  // Thank-you emails carry no template, so they use the global brand design.
  let emailDesign;
  if (ch.email) {
    try { emailDesign = await resolveEmailDesign(); }
    catch (err) { console.error("[thankYou] could not resolve email design:", err?.message); }
  }

  const jobs = [];

  // ── Lead ────────────────────────────────────────────────────────────────
  if (rc.lead) {
    if (ch.whatsapp) jobs.push(sendOne({ client, label: "lead/whatsapp", channel: "whatsapp", content: msg.leadWhatsapp, to: client.phone, vars, scheduledFor, createdBy }));
    if (ch.email)    jobs.push(sendOne({ client, label: "lead/email",    channel: "email",    content: msg.leadEmail,    to: client.email, vars, scheduledFor, createdBy, emailDesign }));
  }

  // ── Referral person (sends only fire when referral contact + message exist) ──
  if (rc.referral) {
    if (ch.whatsapp) jobs.push(sendOne({ client, label: "referral/whatsapp", channel: "whatsapp", content: msg.referralWhatsapp, to: client.referrerPhone, vars, scheduledFor, createdBy }));
    if (ch.email)    jobs.push(sendOne({ client, label: "referral/email",    channel: "email",    content: msg.referralEmail,    to: client.referrerEmail, vars, scheduledFor, createdBy, emailDesign }));
  }

  const results = await Promise.all(jobs);
  const queued = results.filter((x) => x === "queued").length;

  // Persist comm logs + idempotency stamp (best-effort — never throw).
  try {
    client.automation = client.automation || {};
    client.automation.thankYouQueuedAt = new Date();
    if (delayMs > 0) client.automation.thankYouScheduledFor = scheduledFor;
    await client.save();
  } catch (err) {
    console.error("[thankYou] could not persist stamp/logs:", err?.message);
  }

  console.log(`[thankYou] lead ${client._id}: queued ${queued}/${results.length} message(s), delay ${delayValue} ${delayUnit}`);
};

module.exports = { triggerThankYou, buildVariables };
