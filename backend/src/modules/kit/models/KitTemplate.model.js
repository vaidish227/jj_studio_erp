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

    // WhatsApp media
    mediaType: { type: String, enum: MEDIA_TYPES, default: "none" },
    mediaUrl:  { type: String },

    variables: [{ type: String }],
    isActive:  { type: Boolean, default: true },
    createdBy: { type: ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "kit_templates" }
);

kitTemplateSchema.index({ channel: 1, isActive: 1 });
kitTemplateSchema.index({ category: 1, isActive: 1 });

module.exports = mongoose.model("KitTemplate", kitTemplateSchema);
