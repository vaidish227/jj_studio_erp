/**
 * kickoffService — fires the automatic "Project Kickoff" notifications once a
 * proposal has BOTH the advance payment received AND the e-sign received.
 *
 * It is called (fire-and-forget) from every place advance or e-sign is recorded.
 * `maybeTrigger` re-reads the proposal, verifies both signals, and atomically
 * claims the trigger via an idempotency stamp on the proposal — so it fires
 * EXACTLY ONCE regardless of which signal arrives last or which endpoint records
 * it. It never auto-starts the project; it only notifies.
 *
 * Internal recipients (team/PM + management) get an in-app notification plus
 * optional email/WhatsApp on their own contact details. The client gets email +
 * WhatsApp only. Message content comes INLINE from the KickoffSettings singleton.
 *
 * Every individual send is independently guarded and the whole thing swallows its
 * own errors, so it can never break the parent request.
 */
const KickoffSettings = require("../models/KickoffSettings.model");
const Proposal        = require("../../crm/models/Proposal.model");
const User            = require("../../auth/models/user.model");
const { renderTemplate } = require("../../mail/service/mail.service");
const mailQueue        = require("../../mail/service/mail.queue.service");
const whatsappQueue    = require("../../whatsapp/service/whatsapp.queue.service");
const { wrapEmailHtml } = require("../../mail/service/emailLayout");
const { resolveEmailDesign } = require("./emailDesignService");
const { dispatch: notify, getAdminUserIds } = require("../../notifications/services/notificationDispatcher");

const COMPANY_NAME = process.env.COMPANY_NAME || "JJ Studio";

const firstWord = (s) => (typeof s === "string" ? s.trim().split(/\s+/)[0] : undefined);

const fmtCurrency = (n) => {
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return undefined;
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(num);
  } catch {
    return `₹${num}`;
  }
};

/**
 * buildVariables — flat `{{token}}` map for the proposal + its lead. Empty values
 * are dropped so unresolved tokens stay intact.
 */
const buildVariables = (proposal, lead) => {
  const raw = {
    client_name:    lead?.name,
    first_name:     firstWord(lead?.name),
    phone:          lead?.phone,
    email:          lead?.email,
    city:           lead?.city,
    project_type:   lead?.projectType,

    proposal_title: proposal?.title,
    proposal_amount: fmtCurrency(proposal?.finalAmount),
    advance_amount:  fmtCurrency(proposal?.advancePayment?.amount || proposal?.payments?.amount),

    company_name:   COMPANY_NAME,
  };

  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v !== undefined && v !== null && v !== "") out[k] = String(v);
  }
  return out;
};

const render = (t, vars) => (t ? renderTemplate(t, vars) : undefined);

const UNIT_MS = { minutes: 60 * 1000, hours: 60 * 60 * 1000, days: 24 * 60 * 60 * 1000 };
const computeScheduledFor = (settings) => {
  const delayValue = Number(settings.delayValue) || 0;
  const delayUnit  = UNIT_MS[settings.delayUnit] ? settings.delayUnit : "minutes";
  const delayMs = delayValue > 0 ? delayValue * UNIT_MS[delayUnit] : 0;
  return delayMs > 0 ? new Date(Date.now() + delayMs) : new Date();
};

// Queue a single email (best-effort — never throws).
const sendEmail = async ({ to, content, vars, scheduledFor, createdBy, emailDesign, recordId, fallbackSubject }) => {
  try {
    if (!to) return "skipped";
    const bodyTpl = content && content.body;
    if (!bodyTpl || !String(bodyTpl).trim()) return "skipped";
    const subject = render(content.subject, vars) || fallbackSubject;
    const body    = render(bodyTpl, vars) || "";
    await mailQueue.enqueue({
      to, subject, html: wrapEmailHtml(body, emailDesign), text: body,
      scheduledFor, relatedTo: { module: "kit", recordId }, createdBy,
    });
    return "queued";
  } catch (err) {
    console.error("[kickoff] email send failed:", err?.message);
    return "failed";
  }
};

// Queue a single WhatsApp message (best-effort — never throws).
const sendWhatsapp = async ({ to, content, vars, scheduledFor, createdBy, recordId }) => {
  try {
    if (!to) return "skipped";
    const bodyTpl = content && content.body;
    if (!bodyTpl || !String(bodyTpl).trim()) return "skipped";
    const message = render(bodyTpl, vars) || "";
    await whatsappQueue.enqueue({ to, message, scheduledFor, relatedTo: { module: "kit", recordId }, createdBy });
    return "queued";
  } catch (err) {
    console.error("[kickoff] whatsapp send failed:", err?.message);
    return "failed";
  }
};

/**
 * resolveInternalUsers — returns the User docs (id/name/email/phone) for the
 * enabled internal recipients: team (proposal owner) + management (MD/admins).
 */
const resolveInternalUsers = async (proposal, recipients) => {
  const ids = new Set();
  if (recipients.team && proposal.createdBy) ids.add(String(proposal.createdBy));
  if (recipients.management) {
    try {
      const admins = await getAdminUserIds();
      admins.forEach((id) => ids.add(String(id)));
    } catch (err) {
      console.error("[kickoff] could not resolve admins:", err?.message);
    }
  }
  if (!ids.size) return [];
  try {
    return await User.find({ _id: { $in: [...ids] }, isActive: true })
      .select("_id name email phone")
      .lean();
  } catch (err) {
    console.error("[kickoff] could not load internal users:", err?.message);
    return [];
  }
};

/**
 * maybeTrigger — main entry. Loads the proposal, verifies BOTH the advance and
 * e-sign are received, atomically claims the trigger (idempotency), then queues
 * the configured kickoff messages. Safe to call fire-and-forget.
 *
 * @param {String|ObjectId} proposalId
 * @param {Object} [actor]  req.user (recorded as createdBy on queued jobs)
 */
const maybeTrigger = async (proposalId, actor) => {
  if (!proposalId) return;

  let proposal;
  try {
    proposal = await Proposal.findById(proposalId).populate("leadId", "name email phone projectType city");
  } catch (err) {
    console.error("[kickoff] could not load proposal:", err?.message);
    return;
  }
  if (!proposal) return;

  // Both signals must be present.
  const bothReceived = proposal.esign?.status === "received" && proposal.payments?.status === "received";
  if (!bothReceived) return;

  // Already fired? (cheap pre-check before the atomic claim).
  if (proposal.automation && proposal.automation.kickoffQueuedAt) return;

  let settings;
  try {
    settings = await KickoffSettings.getOrCreateDefaults();
  } catch (err) {
    console.error("[kickoff] could not load settings:", err?.message);
    return;
  }
  if (!settings.enabled) return;

  const scheduledFor = computeScheduledFor(settings);

  // Atomic claim — only the first caller that flips the stamp proceeds. This
  // prevents double-fires when advance + e-sign land near-simultaneously.
  let claim;
  try {
    claim = await Proposal.updateOne(
      { _id: proposal._id, "automation.kickoffQueuedAt": { $exists: false } },
      { $set: { "automation.kickoffQueuedAt": new Date(), "automation.kickoffScheduledFor": scheduledFor } }
    );
  } catch (err) {
    console.error("[kickoff] could not claim trigger:", err?.message);
    return;
  }
  if (!claim || claim.modifiedCount !== 1) return; // someone else already claimed it

  const createdBy = actor?._id || actor?.id || undefined;
  const lead = proposal.leadId || {};
  const vars = buildVariables(proposal, lead);
  const ch  = settings.channels   || {};
  const rc  = settings.recipients || {};
  const msg = settings.messages   || {};

  // Resolve the global brand design once for any inline emails.
  let emailDesign;
  if (ch.email) {
    try { emailDesign = await resolveEmailDesign(); }
    catch (err) { console.error("[kickoff] could not resolve email design:", err?.message); }
  }

  const jobs = [];

  // ── Internal audience (team/PM + management) ───────────────────────────────
  const wantInternal = rc.team || rc.management;
  if (wantInternal) {
    const internalUsers = await resolveInternalUsers(proposal, rc);

    // In-app notification (one fan-out to all internal recipient ids).
    if (ch.app && internalUsers.length) {
      const title = render(msg.internalApp?.title, vars) || `Project ready to kick off — ${vars.client_name || "client"}`;
      const body  = render(msg.internalApp?.body, vars) || "";
      jobs.push(
        notify({
          type: "project.kickoff_ready",
          module: "pms",
          priority: "high",
          title,
          message: body,
          link: `/proposal/review/${proposal._id}`,
          recipients: internalUsers.map((u) => u._id),
          skipAdmins: true, // recipients already include admins when management is on
          actor: actor ? { _id: createdBy, name: actor.name } : undefined,
          notifyActor: true,
          relatedTo: { module: "proposal", recordId: proposal._id },
          metadata: { clientName: vars.client_name },
        }).catch((err) => console.error("[kickoff] in-app notify failed:", err?.message))
      );
    }

    // Email / WhatsApp to each internal user on their own contact details.
    for (const u of internalUsers) {
      if (ch.email)    jobs.push(sendEmail({ to: u.email, content: msg.internalEmail, vars, scheduledFor, createdBy, emailDesign, recordId: proposal._id, fallbackSubject: "Project ready to kick off" }));
      if (ch.whatsapp) jobs.push(sendWhatsapp({ to: u.phone, content: msg.internalWhatsapp, vars, scheduledFor, createdBy, recordId: proposal._id }));
    }
  }

  // ── Client audience (email + WhatsApp only) ────────────────────────────────
  if (rc.client) {
    if (ch.email)    jobs.push(sendEmail({ to: lead.email, content: msg.clientEmail, vars, scheduledFor, createdBy, emailDesign, recordId: proposal._id, fallbackSubject: "Your project is starting" }));
    if (ch.whatsapp) jobs.push(sendWhatsapp({ to: lead.phone, content: msg.clientWhatsapp, vars, scheduledFor, createdBy, recordId: proposal._id }));
  }

  const results = await Promise.all(jobs);
  const queued = results.filter((x) => x === "queued").length;
  console.log(`[kickoff] proposal ${proposal._id}: queued ${queued} message(s) + in-app, scheduledFor ${scheduledFor.toISOString()}`);
};

module.exports = { maybeTrigger, buildVariables };
