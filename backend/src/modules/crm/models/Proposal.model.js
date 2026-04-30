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
      required: true,
    },


    title: {
      type: String,
      required: true,
    },

    description: String,

    status: {
      type: String,
      enum: [
        "draft",
        "internal_approved",
        "manager_approved",
        "sent",
        "client_approved",
        "rejected",
      ],
      default: "draft",
    },


    totalAmount: {
      type: Number,
      default: 0,
    },

    gst: {
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