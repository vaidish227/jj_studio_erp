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
        "pending_approval", 
        "internal_approved",
        "manager_approved",
        "sent",
        "esign_pending",
        "signed",
        "client_approved",
        "rejected",
      ],
      default: "draft",
    },

    esignStatus: {
      type: String,
      enum: ["pending", "completed", "n/a"],
      default: "pending",
    },
    esignSignedAt: Date,

    advancePayment: {
      amount: { type: Number, default: 0 },
      paidBy: String,
      paymentDate: Date,
      paymentMethod: String, // cash, bank_transfer, cheque, etc.
      remarks: String
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
    approvalHistory: [
      {
        action: String, // approved, rejected, modified, sent
        performedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        },
        remarks: String,
        timestamp: {
          type: Date,
          default: Date.now
        }
      }
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Proposal", proposalSchema);