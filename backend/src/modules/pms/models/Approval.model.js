const mongoose = require("mongoose");

/**
 * PMS Approval Schema
 * Tracks formal approvals from the Client or Principal Designer for drawings/concepts.
 */
const approvalSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    
    // --- Target of Approval ---
    targetType: {
      type: String,
      enum: ["drawing", "concept", "material", "quotation"],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId, // Refers to Drawing, Task, or Material
      required: true,
    },

    // --- Stakeholders ---
    approverType: {
      type: String,
      enum: ["client", "manager", "principal_designer"],
      required: true,
    },
    approverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // For manager/designer. Client is tracked by name/flag.
    },

    // --- Response ---
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "approved_with_changes"],
      default: "pending",
    },
    comments: String,
    attachments: [String], // Proof of approval (e.g., screenshot of WhatsApp/Email)
    
    respondedAt: Date,
  },
  {
    timestamps: true,
    collection: "pms_approvals",
  }
);

module.exports = mongoose.model("PMSApproval", approvalSchema, "pms_approvals");
