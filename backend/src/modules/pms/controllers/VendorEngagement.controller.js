/**
 * VendorEngagement.controller — Phase 2 state machine.
 *
 * Endpoints (mounted at /api/pms/vendor-engagement):
 *   POST   /create                           — start engagement (auto-creates per-vendor WA group)
 *   GET    /project/:projectId               — list engagements for a project
 *   GET    /:id                              — single engagement (populated)
 *   PATCH  /:id/quote                        — record quote → status: quoted
 *   PATCH  /:id/client-approval              — record client approval (also flips Project.clientApprovals)
 *   POST   /:id/emit-po                      — create PO (blocked unless client_approved)
 *   PATCH  /:id/delivered                    — mark delivered
 *   PATCH  /:id/site-received                — mark site_received
 *   PATCH  /:id/cancel                       — cancel with reason
 *
 * Reuses:
 *   - workflowEngine.onClientApprovalObtained  → closes gate_<kind>_client when applicable
 *   - PurchaseOrder.create                     → unchanged path; auto-numbering happens in the model
 *   - vendorWhatsAppGroup.createPerVendorGroup → spawns the WhatsAppProjectGroup
 */

const mongoose = require("mongoose");
const VendorEngagement = require("../models/VendorEngagement.model");
const ApprovalGate = require("../models/ApprovalGate.model");
const Project = require("../models/Project.model");
const PurchaseOrder = require("../models/PurchaseOrder.model");
const Task = require("../models/Task.model");
const {
  createEngagementSchema,
  recordQuoteSchema,
  recordClientApprovalSchema,
  emitPOSchema,
  recordDeliverySchema,
  cancelEngagementSchema,
} = require("../validator/VendorEngagement.validator");
const { logActivity } = require("../../../shared/activityLogger");
const workflowEngine = require("../services/workflowEngine");
const { createPerVendorGroup } = require("../services/vendorWhatsAppGroup");

let notify = () => {};
try {
  ({ dispatch: notify } = require("../../notifications/services/notificationDispatcher"));
} catch (e) { /* optional */ }

const VENDOR_KIND_TO_CLIENT_APPROVAL = {
  ac: "ac",
  automation: "automation",
  kitchen: "kitchen",
};

const VENDOR_KIND_TO_GATE = {
  ac: "gate_ac_client",
  automation: "gate_automation_client",
  kitchen: "gate_kitchen_material",
};

function pushHistory(engagement, fromStatus, toStatus, actorId, notes) {
  engagement.history.push({
    at: new Date(),
    actorId,
    fromStatus,
    toStatus,
    notes,
  });
}

/**
 * @route POST /api/pms/vendor-engagement/create
 */
const createEngagement = async (req, res) => {
  try {
    const { error, value } = createEngagementSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });
    }
    if (!value.taskId) delete value.taskId;

    // Look up the matching client approval gate so we can link it
    const gate = await ApprovalGate.findOne({
      projectId: value.projectId,
      gateType: VENDOR_KIND_TO_GATE[value.vendorKind],
    }).lean();

    const engagement = await VendorEngagement.create({
      projectId: value.projectId,
      taskId: value.taskId || undefined,
      vendorId: value.vendorId,
      vendorKind: value.vendorKind,
      status: "requested",
      clientApprovalGateId: gate?._id || undefined,
      notes: value.notes || "",
      history: [
        {
          at: new Date(),
          actorId: req.user._id,
          fromStatus: null,
          toStatus: "requested",
          notes: "Engagement created",
        },
      ],
      createdBy: req.user._id,
    });

    // Per-vendor WA group (best-effort — failure here does not block engagement creation)
    let whatsappGroup = null;
    if (value.createWhatsAppGroup !== false) {
      try {
        whatsappGroup = await createPerVendorGroup({
          engagement,
          gate,
          actorId: req.user._id,
        });
        engagement.whatsappGroupId = whatsappGroup._id;
        await engagement.save();
      } catch (waErr) {
        console.warn("[VendorEngagement] WA group creation failed:", waErr.message);
      }
    }

    // Keep legacy externalCoordination in sync for backward compatibility
    if (engagement.taskId) {
      await Task.findByIdAndUpdate(engagement.taskId, {
        $set: {
          "externalCoordination.isNeeded": true,
          "externalCoordination.vendorId": engagement.vendorId,
        },
      });
    }

    try {
      await logActivity({
        projectId: engagement.projectId,
        actorId: req.user._id,
        entityType: "task",
        entityId: engagement._id,
        action: "created",
        description: `Vendor engagement opened (${engagement.vendorKind})`,
        metadata: { vendorId: engagement.vendorId, whatsappGroupId: engagement.whatsappGroupId },
      });
    } catch (e) { /* best-effort */ }

    try {
      notify({
        type: "vendor.engagement_opened",
        module: "pms",
        priority: "normal",
        title: `Vendor engagement opened (${engagement.vendorKind})`,
        message: whatsappGroup
          ? `Per-vendor WhatsApp group created: ${whatsappGroup.groupName}`
          : "Engagement created — WhatsApp group skipped",
        link: `/projects/${engagement.projectId}`,
        relatedTo: { module: "pms", recordId: engagement.projectId },
        metadata: { engagementId: engagement._id, vendorKind: engagement.vendorKind },
      });
    } catch (e) { /* best-effort */ }

    const populated = await VendorEngagement.findById(engagement._id)
      .populate("vendorId", "name phone email category")
      .populate("whatsappGroupId", "groupName members syncStatus")
      .lean();

    res.status(201).json({ message: "Engagement created", engagement: populated });
  } catch (err) {
    console.error("[createEngagement]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route GET /api/pms/vendor-engagement/project/:projectId
 */
const getEngagementsByProject = async (req, res) => {
  try {
    const list = await VendorEngagement.find({ projectId: req.params.projectId })
      .populate("vendorId", "name phone email category")
      .populate("whatsappGroupId", "groupName members syncStatus")
      .populate("poId", "poNumber status totalAmount paymentStatus")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ count: list.length, engagements: list });
  } catch (err) {
    console.error("[getEngagementsByProject]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route GET /api/pms/vendor-engagement/:id
 */
const getEngagementById = async (req, res) => {
  try {
    const e = await VendorEngagement.findById(req.params.id)
      .populate("vendorId", "name phone email category contactPerson")
      .populate("whatsappGroupId")
      .populate("poId")
      .populate("taskId", "title taskType status")
      .lean();
    if (!e) return res.status(404).json({ message: "Engagement not found" });
    res.json({ engagement: e });
  } catch (err) {
    console.error("[getEngagementById]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route PATCH /api/pms/vendor-engagement/:id/quote
 */
const recordQuote = async (req, res) => {
  try {
    const { error, value } = recordQuoteSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });

    const engagement = await VendorEngagement.findById(req.params.id);
    if (!engagement) return res.status(404).json({ message: "Engagement not found" });
    if (!["requested", "quoted"].includes(engagement.status)) {
      return res.status(409).json({
        code: "INVALID_STATE_TRANSITION",
        message: `Cannot record quote from status "${engagement.status}"`,
      });
    }

    const from = engagement.status;
    engagement.amount = value.amount;
    if (value.quotationUrl) engagement.quotationUrl = value.quotationUrl;
    engagement.status = "quoted";
    pushHistory(engagement, from, "quoted", req.user._id, value.notes || "Quote recorded");
    await engagement.save();

    // Keep legacy externalCoordination in sync
    if (engagement.taskId) {
      await Task.findByIdAndUpdate(engagement.taskId, {
        $set: {
          "externalCoordination.amount": value.amount,
          "externalCoordination.quotationUrl": value.quotationUrl || engagement.quotationUrl,
        },
      });
    }

    res.json({ message: "Quote recorded", engagement });
  } catch (err) {
    console.error("[recordQuote]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route PATCH /api/pms/vendor-engagement/:id/client-approval
 * Marks the engagement as client_approved AND flips Project.clientApprovals[<kind>] = "obtained",
 * which triggers the engine cascade (closes the corresponding gate_<kind>_client / gate_kitchen_material).
 */
const recordClientApproval = async (req, res) => {
  try {
    const { error, value } = recordClientApprovalSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });

    const engagement = await VendorEngagement.findById(req.params.id);
    if (!engagement) return res.status(404).json({ message: "Engagement not found" });
    if (engagement.status !== "quoted") {
      return res.status(409).json({
        code: "INVALID_STATE_TRANSITION",
        message: `Cannot record client approval from status "${engagement.status}"`,
      });
    }

    const from = engagement.status;
    engagement.status = "client_approved";
    if (value.approvalId) engagement.clientApprovalId = value.approvalId;
    pushHistory(engagement, from, "client_approved", req.user._id, value.notes || "Client approval received");
    await engagement.save();

    // Flip Project.clientApprovals[<kind>] = obtained → triggers gate cascade
    const clientApprovalType = VENDOR_KIND_TO_CLIENT_APPROVAL[engagement.vendorKind];
    if (clientApprovalType) {
      const project = await Project.findById(engagement.projectId);
      if (project) {
        const idx = project.clientApprovals.findIndex((a) => a.type === clientApprovalType);
        if (idx > -1) {
          project.clientApprovals[idx].status = "obtained";
          project.clientApprovals[idx].obtainedAt = new Date();
        } else {
          project.clientApprovals.push({
            type: clientApprovalType,
            status: "obtained",
            obtainedAt: new Date(),
          });
        }
        await project.save();

        try {
          await workflowEngine.onClientApprovalObtained({
            projectId: project._id,
            approvalType: clientApprovalType,
            actorId: req.user._id,
          });
          await workflowEngine.recomputeProjectPhase(project._id);
        } catch (engineErr) {
          console.error("[recordClientApproval:engine]", engineErr);
        }
      }
    }

    // Sync legacy flag
    if (engagement.taskId) {
      await Task.findByIdAndUpdate(engagement.taskId, {
        $set: { "externalCoordination.isApprovedByClient": true },
      });
    }

    res.json({ message: "Client approval recorded", engagement });
  } catch (err) {
    console.error("[recordClientApproval]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route POST /api/pms/vendor-engagement/:id/emit-po
 * PO emission is blocked unless engagement.status === "client_approved".
 * Creates a PurchaseOrder, sets engagement.poId, transitions to po_emitted.
 */
const emitPO = async (req, res) => {
  try {
    const { error, value } = emitPOSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });

    const engagement = await VendorEngagement.findById(req.params.id);
    if (!engagement) return res.status(404).json({ message: "Engagement not found" });

    if (engagement.status !== "client_approved") {
      return res.status(409).json({
        code: "PO_EMIT_NOT_ALLOWED",
        message: `Cannot emit PO — engagement status is "${engagement.status}". Client approval required first.`,
      });
    }

    // Auto-compute amounts where missing
    const items = value.items.map((it) => ({
      ...it,
      amount: it.amount ?? it.quantity * it.rate,
    }));
    const totalAmount = items.reduce((sum, it) => sum + (it.amount || 0), 0);

    const po = await PurchaseOrder.create({
      projectId: engagement.projectId,
      vendorId: engagement.vendorId,
      taskId: engagement.taskId,
      items,
      totalAmount,
      expectedDeliveryDate: value.expectedDeliveryDate,
      status: "draft",
    });

    const from = engagement.status;
    engagement.poId = po._id;
    engagement.status = "po_emitted";
    pushHistory(engagement, from, "po_emitted", req.user._id, value.notes || `PO ${po.poNumber || po._id} emitted`);
    await engagement.save();

    try {
      await logActivity({
        projectId: engagement.projectId,
        actorId: req.user._id,
        entityType: "purchase_order",
        entityId: po._id,
        action: "created",
        description: `PO emitted for vendor engagement (${engagement.vendorKind})`,
      });
    } catch (e) { /* best-effort */ }

    res.status(201).json({ message: "PO emitted", engagement, po });
  } catch (err) {
    console.error("[emitPO]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route PATCH /api/pms/vendor-engagement/:id/delivered
 */
const markDelivered = async (req, res) => {
  try {
    const { error, value } = recordDeliverySchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });

    const engagement = await VendorEngagement.findById(req.params.id);
    if (!engagement) return res.status(404).json({ message: "Engagement not found" });
    if (engagement.status !== "po_emitted") {
      return res.status(409).json({
        code: "INVALID_STATE_TRANSITION",
        message: `Cannot mark delivered from status "${engagement.status}"`,
      });
    }

    const from = engagement.status;
    engagement.status = "delivered";
    pushHistory(engagement, from, "delivered", req.user._id, value.notes || "Delivered");
    await engagement.save();

    if (engagement.poId) {
      await PurchaseOrder.findByIdAndUpdate(engagement.poId, {
        $set: {
          status: "delivered",
          actualDeliveryDate: value.actualDeliveryDate || new Date(),
        },
      });
    }

    res.json({ message: "Marked delivered", engagement });
  } catch (err) {
    console.error("[markDelivered]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route PATCH /api/pms/vendor-engagement/:id/site-received
 */
const markSiteReceived = async (req, res) => {
  try {
    const engagement = await VendorEngagement.findById(req.params.id);
    if (!engagement) return res.status(404).json({ message: "Engagement not found" });
    if (engagement.status !== "delivered") {
      return res.status(409).json({
        code: "INVALID_STATE_TRANSITION",
        message: `Cannot mark site_received from status "${engagement.status}"`,
      });
    }

    const from = engagement.status;
    engagement.status = "site_received";
    pushHistory(engagement, from, "site_received", req.user._id, req.body?.notes || "Site received");
    await engagement.save();
    res.json({ message: "Marked site received", engagement });
  } catch (err) {
    console.error("[markSiteReceived]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route PATCH /api/pms/vendor-engagement/:id/cancel
 */
const cancelEngagement = async (req, res) => {
  try {
    const { error, value } = cancelEngagementSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });

    const engagement = await VendorEngagement.findById(req.params.id);
    if (!engagement) return res.status(404).json({ message: "Engagement not found" });
    if (["po_emitted", "delivered", "site_received"].includes(engagement.status)) {
      return res.status(409).json({
        message: `Cannot cancel engagement in "${engagement.status}" — PO already emitted.`,
      });
    }

    const from = engagement.status;
    engagement.status = "cancelled";
    pushHistory(engagement, from, "cancelled", req.user._id, value.reason);
    await engagement.save();

    res.json({ message: "Engagement cancelled", engagement });
  } catch (err) {
    console.error("[cancelEngagement]", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createEngagement,
  getEngagementsByProject,
  getEngagementById,
  recordQuote,
  recordClientApproval,
  emitPO,
  markDelivered,
  markSiteReceived,
  cancelEngagement,
};
