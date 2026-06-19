const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

/**
 * ThankYouSettings (kit_thank_you_settings) — singleton config doc that drives
 * the automatic post-enquiry thank-you automation (lead + referral person,
 * WhatsApp + Email). Managed from one simple admin screen: KIT → Thank You
 * Automation.
 *
 * The message content lives INLINE here (not as separate KitTemplate docs) so
 * the whole feature — timing, toggles, and the four messages — is managed from a
 * single client-friendly page. Bodies use the `{{variable}}` token syntax.
 *
 * Exactly one document exists (key: "thank_you"). Read it via getOrCreateDefaults().
 */

// Friendly starter wording so the screen is never blank for a new client.
const DEFAULT_MESSAGES = {
  leadWhatsapp: {
    body: "Hi {{lead_name}}, thank you for your enquiry with {{company_name}}! Our team will get in touch with you shortly.",
  },
  leadEmail: {
    subject: "Thank you for your enquiry, {{lead_name}}",
    body: "Hi {{lead_name}},\n\nThank you for reaching out to {{company_name}}. We've received your enquiry and our team will contact you shortly.\n\nWarm regards,\n{{company_name}}",
  },
  referralWhatsapp: {
    body: "Hi {{referral_name}}, thank you for referring {{lead_name}} to {{company_name}}. We truly appreciate it!",
  },
  referralEmail: {
    subject: "Thank you for your referral, {{referral_name}}",
    body: "Hi {{referral_name}},\n\nThank you for referring {{lead_name}} to {{company_name}}. We appreciate your trust and will take great care of them.\n\nWarm regards,\n{{company_name}}",
  },
};

const thankYouSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "thank_you", unique: true },

    // Master switch. When false, no thank-you messages are ever queued.
    enabled: { type: Boolean, default: false },

    // How long to wait after enquiry submission before sending. 0 = immediate.
    delayValue: { type: Number, default: 0, min: 0 },
    delayUnit:  { type: String, enum: ["minutes", "hours", "days"], default: "hours" },

    channels: {
      whatsapp: { type: Boolean, default: true },
      email:    { type: Boolean, default: true },
    },

    recipients: {
      lead:     { type: Boolean, default: true },
      referral: { type: Boolean, default: true },
    },

    // Inline message content (the four slots). Uses {{variable}} tokens.
    messages: {
      leadWhatsapp:     { body: { type: String, default: DEFAULT_MESSAGES.leadWhatsapp.body } },
      leadEmail:        { subject: { type: String, default: DEFAULT_MESSAGES.leadEmail.subject }, body: { type: String, default: DEFAULT_MESSAGES.leadEmail.body } },
      referralWhatsapp: { body: { type: String, default: DEFAULT_MESSAGES.referralWhatsapp.body } },
      referralEmail:    { subject: { type: String, default: DEFAULT_MESSAGES.referralEmail.subject }, body: { type: String, default: DEFAULT_MESSAGES.referralEmail.body } },
    },

    updatedBy: { type: ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "kit_thank_you_settings" }
);

/**
 * getOrCreateDefaults — always returns the singleton settings doc, creating a
 * disabled default (with starter wording) the first time it's requested.
 */
thankYouSettingsSchema.statics.getOrCreateDefaults = async function () {
  let doc = await this.findOne({ key: "thank_you" });
  if (!doc) doc = await this.create({ key: "thank_you" });
  return doc;
};

module.exports = mongoose.model("ThankYouSettings", thankYouSettingsSchema);
