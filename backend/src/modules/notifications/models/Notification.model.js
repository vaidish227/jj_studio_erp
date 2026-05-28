const mongoose = require("mongoose");

/**
 * Notification — in-app notification record for a single recipient.
 *
 * One document per (recipient, event). When an event fires (e.g. "meeting
 * scheduled") the dispatcher fans out one Notification document per resolved
 * recipient. The bell badge + inbox read from this collection.
 *
 * Indexes are tuned for the two hottest queries:
 *   1) count unread for current user      → { recipientId, readAt }
 *   2) list latest for current user       → { recipientId, createdAt -1 }
 */
const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Stable machine string, e.g. "lead.created", "meeting.scheduled",
    // "task.assigned", "proposal.sent". Used by clients to filter, group,
    // and decide UI styling (icon, color, route).
    type: { type: String, required: true, index: true },

    // Coarse grouping for the inbox filter row: "crm", "pms", "meeting",
    // "proposal", "auth", "system", etc.
    module: { type: String, required: true, index: true },

    // Free-form human display. The dispatcher composes both.
    title: { type: String, required: true },
    message: { type: String, default: "" },

    // Frontend deep-link, e.g. "/crm/clients/123" or "/pms/task/456".
    // The bell dropdown navigates here on click.
    link: { type: String, default: "" },

    priority: {
      type: String,
      enum: ["low", "normal", "high"],
      default: "normal",
      index: true,
    },

    // Cross-link to the source record (audit trail, future deduplication).
    relatedTo: {
      module: String,
      recordId: { type: mongoose.Schema.Types.ObjectId },
    },

    // Who triggered the event (optional — useful for "Vaidish assigned you a task").
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    actorName: String,

    // Per-event extras (free-form). Useful for the UI to render richer rows
    // without an extra fetch — e.g. { leadName, amount, oldDate, newDate }.
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

    // null = unread. Set when the recipient marks it read.
    readAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

// Hot path: "unread count for me" and "latest 20 for me"
notificationSchema.index({ recipientId: 1, readAt: 1 });
notificationSchema.index({ recipientId: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
