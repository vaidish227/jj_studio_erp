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
        "manager_approved",
        "sent",
        "esign_received",
        "payment_received",
        "project_ready",
        "rejected",
        "project_started",
      ],
      default: "draft",
    },

    esignStatus: {
      type: String,
      enum: ["pending", "completed", "n/a"],
      default: "pending",
    },
    esignSignedAt: Date,

    // New eSign tracking fields per requirements
    esign: {
      status: { type: String, enum: ["pending", "received"], default: "pending" },
      signed_at: Date
    },

    advancePayment: {
      amount: { type: Number, default: 0 },
      paidBy: String,
      paymentDate: Date,
      paymentMethod: String, // cash, bank_transfer, cheque, etc.
      remarks: String
    },

    // New payment tracking fields per requirements
    payments: {
      status: { type: String, enum: ["pending", "received"], default: "pending" },
      amount: { type: Number, default: 0 },
      received_at: Date,
      method: { type: String, default: "cash" },
      transactionRef: { type: String, default: "N/A" }
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

    // New approval tracking fields per requirements
    approved_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approved_at: Date,
    rejected_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    rejection_reason: String,

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