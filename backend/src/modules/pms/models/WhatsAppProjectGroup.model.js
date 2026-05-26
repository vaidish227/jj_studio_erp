const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema(
  {
    // Optional — links to an ERP user. Null for external/client members.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    phone: { type: String, required: true },
    name:  { type: String },
    role:  { type: String },

    // Categorises member origin for display and filtering
    memberType: {
      type: String,
      enum: ["team_member", "client", "external"],
      default: "team_member",
    },

    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },

    // null = unknown (not yet verified), true/false = result of WA check
    hasWhatsApp: {
      type: Boolean,
      default: null,
    },
  },
  { _id: false }
);

const whatsAppProjectGroupSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    groupType: {
      type: String,
      enum: ["main", "drawing", "supervision", "payment", "custom"],
      required: true,
    },

    groupName: {
      type: String,
      required: true,
      trim: true,
    },

    // ID returned by the WhatsApp provider when the group is created/linked via Maytapi
    providerGroupId: {
      type: String,
      default: null,
    },

    // Tracks whether this ERP group has been synchronised with a real WhatsApp group
    syncStatus: {
      type: String,
      enum: ["unsynced", "synced", "partial", "failed"],
      default: "unsynced",
    },
    syncedAt:   { type: Date, default: null },
    syncErrors: { type: [String], default: [] },

    members: { type: [memberSchema], default: [] },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    lastMessageAt: Date,
    messageCount:  { type: Number, default: 0 },

    notes: String,
  },
  {
    timestamps: true,
    collection: "pms_whatsapp_groups",
  }
);

whatsAppProjectGroupSchema.index({ projectId: 1 });
whatsAppProjectGroupSchema.index({ groupType: 1 });
whatsAppProjectGroupSchema.index({ syncStatus: 1 });
whatsAppProjectGroupSchema.index({ createdBy: 1 });

module.exports = mongoose.model("WhatsAppProjectGroup", whatsAppProjectGroupSchema, "pms_whatsapp_groups");
