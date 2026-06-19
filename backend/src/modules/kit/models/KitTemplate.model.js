const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;
const {
  CHANNELS, TEMPLATE_CATEGORIES, MEDIA_TYPES,
} = require("../constants/enums");

/**
 * KitTemplate (kit_templates) — unified, channel-aware message template.
 *
 * One collection for all channels so the Template Editor is a single UX.
 * Field relevance by channel:
 *   email        → subject, htmlBody, textBody
 *   whatsapp     → body, mediaType, mediaUrl
 *   notification → title, body, deepLink
 *
 * Bodies use the `{{variable}}` syntax rendered by the existing renderTemplate()
 * helpers. `variables` lists the tokens the template declares (validated against
 * the variable catalog in Phase 2).
 */
const kitTemplateSchema = new mongoose.Schema(
  {
    channel:  { type: String, enum: CHANNELS, required: true },
    name:     { type: String, required: true, unique: true, trim: true },
    category: { type: String, enum: TEMPLATE_CATEGORIES, default: "custom" },

    // Email
    subject:  { type: String },
    htmlBody: { type: String },
    textBody: { type: String },

    // WhatsApp / Notification message text
    body: { type: String },

    // Notification-specific
    title:    { type: String },
    deepLink: { type: String },

    // WhatsApp media — legacy single-media (kept for back-compat).
    mediaType: { type: String, enum: MEDIA_TYPES, default: "none" },
    mediaUrl:  { type: String },
    mediaKey:  { type: String },

    // Multiple attachments — each is sent as its own WhatsApp message, in order,
    // after the text. `key` is an S3 object key (signed fresh at send time);
    // `url` is used for externally-hosted links (no key).
    attachments: [{
      kind: { type: String, enum: ["image", "document", "video"] },
      url:  { type: String },
      key:  { type: String },
      name: { type: String },
    }],

    // Per-template email design override (email channel). Every field is optional;
    // a blank field inherits from the global KitSettings design at send time.
    emailDesign: {
      headerColor:     { type: String, default: "" },
      headerTextColor: { type: String, default: "" },
      brandText:       { type: String, default: "" },
      logoUrl:         { type: String, default: "" },
      logoKey:         { type: String, default: "" },
      footerText:      { type: String, default: "" },
      bodyTextColor:   { type: String, default: "" },
      accentColor:     { type: String, default: "" },
      bgColor:         { type: String, default: "" },
    },

    variables: [{ type: String }],
    isActive:  { type: Boolean, default: true },
    createdBy: { type: ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "kit_templates" }
);

kitTemplateSchema.index({ channel: 1, isActive: 1 });
kitTemplateSchema.index({ category: 1, isActive: 1 });

module.exports = mongoose.model("KitTemplate", kitTemplateSchema);
