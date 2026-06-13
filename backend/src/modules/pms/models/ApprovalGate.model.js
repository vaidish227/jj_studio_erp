const mongoose = require("mongoose");

/**
 * ApprovalGate — the enforcement layer's source of truth.
 *
 * A gate is OPEN by default. While open, `blockedActivities[]` cannot proceed
 * (rejected with 409 by gateEnforcement middleware).
 *
 * It CLOSES when the linked approvals are satisfied:
 *   - approverType=client            → Project.clientApprovals[listensTo].status === "obtained"
 *   - approverType=principal_designer → one Approval doc with approverType=principal_designer + status=approved
 *   - approverType=principal_and_client → both records present
 *   - approverType=manager           → one Approval doc with approverType=manager + status=approved
 *
 * Created in bulk by workflowEngine.seedProject from WorkflowTemplate.gates.
 * Closed by:
 *   - Project.controller.updateClientApproval → cycles to "obtained"
 *   - Approval.controller.respondToApproval → status=approved
 *   - explicit override via POST /api/pms/project/:id/gates/:gateId/override
 */

const approvalGateSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    workflowTemplateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkflowTemplate",
    },

    key: { type: String, required: true },              // matches WorkflowTemplate.gates[].key
    gateType: { type: String, required: true },         // gate_furniture_layout, gate_ac_client, ...
    label: { type: String, required: true },

    approverType: {
      type: String,
      enum: ["client", "manager", "principal_designer", "principal_and_client"],
      required: true,
    },
    listensTo: { type: String },                        // Project.clientApprovals[].type when relevant

    blockedActivities: { type: [String], default: [] }, // task.submit, po.emit, drawing.release, drawing.send_to_client, etc.
    blockedTaskIds: {                                   // task ids that are gated by this gate
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Task" }],
      default: [],
    },

    status: {
      type: String,
      enum: ["open", "closed", "overridden"],
      default: "open",
    },
    closedAt: Date,
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    overrideBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    overrideAt: Date,
    overrideReason: String,
  },
  {
    timestamps: true,
    collection: "pms_approval_gates",
  }
);

approvalGateSchema.index({ projectId: 1, status: 1 });
approvalGateSchema.index({ projectId: 1, gateType: 1 });

module.exports = mongoose.model(
  "ApprovalGate",
  approvalGateSchema,
  "pms_approval_gates"
);
