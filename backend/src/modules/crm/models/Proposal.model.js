const mongoose = require("mongoose");

const proposalSchema = new mongoose.Schema(
  {

    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Template",
    },

    boqId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BOQ",
      required: false, // Making optional as we are moving to JSON content
    },

    title: {
      type: String,
      required: true,
    },

    description: String,

    content: {
      type: mongoose.Schema.Types.Mixed, // To store dynamic populated JSON structure
      default: {},
    },

    status: {
      type: String,
      enum: [
        "draft",
        "pending_approval", // Added per requirements
        "internal_approved",
        "manager_approved",
        "sent",
        "client_approved",
        "rejected",
      ],
      default: "draft",
    },

    subtotal: {
      type: Number,
      default: 0,
    },

    gst: {
      type: Number,
      default: 0,
    },

    totalAmount: {
      type: Number,
      default: 0,
    },

    finalAmount: {
      type: Number,
      default: 0,
    },

    sentAt: Date,
    approvedAt: Date,

    version: {
      type: Number,
      default: 1,
    },

    notes: String,

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Proposal", proposalSchema);