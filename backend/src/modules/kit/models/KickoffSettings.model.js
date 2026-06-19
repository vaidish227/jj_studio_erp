const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

/**
 * KickoffSettings (kit_kickoff_settings) — singleton config doc that drives the
 * automatic "Project Kickoff" automation. It fires once a proposal has BOTH the
 * advance payment received AND the e-sign received, announcing that the project
 * is ready to be kicked off.
 *
 * Two audiences:
 *   • internal — the team / project manager + management (MD/admins). They are
 *     ERP users, so they can get an in-app notification plus (optionally) email
 *     and WhatsApp on their own contact details.
 *   • client   — the customer. Not an app user, so email + WhatsApp only.
 *
 * The message content lives INLINE here (not as separate KitTemplate docs) so the
 * whole feature — timing, toggles and the messages — is managed from a single
 * client-friendly admin page: KIT → Project Kickoff. Bodies use `{{variable}}`
 * token syntax. This automation NEVER auto-starts the project; it only notifies.
 *
 * Exactly one document exists (key: "kickoff"). Read it via getOrCreateDefaults().
 */

// Friendly starter wording so the screen is never blank for a new client.
const DEFAULT_MESSAGES = {
  internalApp: {
    title: "Project ready to kick off — {{client_name}}",
    body: "{{client_name}} has paid the advance and signed the proposal. The project is ready to be initiated.",
  },
  internalEmail: {
    subject: "Project ready to kick off — {{client_name}}",
    body: "Hi team,\n\n{{client_name}} ({{project_type}}) has completed both the advance payment and the e-sign for proposal \"{{proposal_title}}\".\n\nThe project is ready to be kicked off. Please initiate the project in PMS.\n\n— {{company_name}}",
  },
  internalWhatsapp: {
    body: "✅ {{client_name}} ({{project_type}}) has paid the advance and signed the proposal. The project is ready to be kicked off — please initiate it in PMS.",
  },
  clientEmail: {
    subject: "Welcome aboard, {{first_name}} — your project is starting!",
    body: "Hi {{first_name}},\n\nThank you! We've received your advance and your signed agreement, and we're excited to begin work on your {{project_type}} project.\n\nOur team will be in touch shortly with the next steps.\n\nWarm regards,\n{{company_name}}",
  },
  clientWhatsapp: {
    body: "Hi {{first_name}}, thank you! We've received your advance and signed agreement. We're excited to kick off your {{project_type}} project with {{company_name}}. Our team will reach out shortly with the next steps.",
  },
};

const kickoffSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "kickoff", unique: true },

    // Master switch. When false, no kickoff messages are ever queued.
    enabled: { type: Boolean, default: false },

    // How long to wait after the second signal (advance + e-sign) is received
    // before sending. 0 = immediate.
    delayValue: { type: Number, default: 0, min: 0 },
    delayUnit:  { type: String, enum: ["minutes", "hours", "days"], default: "minutes" },

    // Channels. `app` is the in-app notification bell (internal users only).
    channels: {
      app:      { type: Boolean, default: true },
      email:    { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: true },
    },

    // Who is notified. team = proposal owner / PM, management = MD/admins,
    // client = the customer.
    recipients: {
      team:       { type: Boolean, default: true },
      management: { type: Boolean, default: true },
      client:     { type: Boolean, default: true },
    },

    // Inline message content. Uses {{variable}} tokens.
    messages: {
      internalApp:      { title: { type: String, default: DEFAULT_MESSAGES.internalApp.title }, body: { type: String, default: DEFAULT_MESSAGES.internalApp.body } },
      internalEmail:    { subject: { type: String, default: DEFAULT_MESSAGES.internalEmail.subject }, body: { type: String, default: DEFAULT_MESSAGES.internalEmail.body } },
      internalWhatsapp: { body: { type: String, default: DEFAULT_MESSAGES.internalWhatsapp.body } },
      clientEmail:      { subject: { type: String, default: DEFAULT_MESSAGES.clientEmail.subject }, body: { type: String, default: DEFAULT_MESSAGES.clientEmail.body } },
      clientWhatsapp:   { body: { type: String, default: DEFAULT_MESSAGES.clientWhatsapp.body } },
    },

    updatedBy: { type: ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "kit_kickoff_settings" }
);

/**
 * getOrCreateDefaults — always returns the singleton settings doc, creating a
 * disabled default (with starter wording) the first time it's requested.
 */
kickoffSettingsSchema.statics.getOrCreateDefaults = async function () {
  let doc = await this.findOne({ key: "kickoff" });
  if (!doc) doc = await this.create({ key: "kickoff" });
  return doc;
};

module.exports = mongoose.model("KickoffSettings", kickoffSettingsSchema);
