const mongoose = require("mongoose");

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

    // ID returned by the WhatsApp provider (Maytapi/Twilio)
    providerGroupId: {
      type: String,
      default: null,
    },

    members: [
      {
        phone: { type: String, required: true },
        name:  { type: String },
        role:  { type: String },
      },
    ],

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

module.exports = mongoose.model("WhatsAppProjectGroup", whatsAppProjectGroupSchema, "pms_whatsapp_groups");
