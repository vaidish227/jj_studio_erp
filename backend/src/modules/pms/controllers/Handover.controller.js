/**
 * Handover.controller — Phase 3b.
 *
 * Closes the Design → Execution workflow loop.
 *
 * Endpoints (mounted at /api/pms/handover):
 *   POST   /project/:projectId/request    — Design lead opens the package
 *   GET    /project/:projectId            — Get the project's handover (or null)
 *   PATCH  /:id/drawings/:itemId          — Walkthrough: tick a drawing as walked/notes
 *   POST   /:id/punch                     — Add a punch-list item
 *   PATCH  /:id/punch/:punchId            — Resolve a punch-list item
 *   POST   /:id/sign                      — Design lead signoff
 *   POST   /:id/accept                    — Supervisor accept → closes gate_handover, phase → execution
 *   POST   /:id/reject                    — Supervisor reject → back to requested
 *
 * Reuses Drawing model (no schema change), ApprovalGate (gate_handover from Phase 1 seed),
 * and workflowEngine.closeGate + recomputeProjectPhase/Progress.
 */

const mongoose = require("mongoose");
const HandoverPackage = require("../models/HandoverPackage.model");
const Project = require("../models/Project.model");
const Drawing = require("../models/Drawing.model");
const Task = require("../models/Task.model");
const ApprovalGate = require("../models/ApprovalGate.model");
const workflowEngine = require("../services/workflowEngine");
const teamResolver = require("../services/teamResolver");
const { logActivity } = require("../../../shared/activityLogger");
const {
  requestHandoverSchema,
  updateDrawingItemSchema,
  addPunchItemSchema,
  resolvePunchItemSchema,
  designLeadSignSchema,
  supervisorAcceptSchema,
  supervisorRejectSchema,
} = require("../validator/Handover.validator");

let notify = () => {};
try {
  ({ dispatch: notify } = require("../../notifications/services/notificationDispatcher"));
} catch (e) { /* optional */ }

const WORKFLOW_ENGINE_V1 =
  String(process.env.WORKFLOW_ENGINE_V1 || "").toLowerCase() === "true";

/**
 * @route POST /api/pms/handover/project/:projectId/request
 * Design lead opens the package. Idempotent — returns existing if already open.
 */
const requestHandover = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: "Invalid project id" });
    }

    const { error, value } = requestHandoverSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });
    }

    // Idempotency — return any non-accepted existing package
    const existing = await HandoverPackage.findOne({ projectId });
    if (existing && existing.status !== "rejected") {
      return res.status(200).json({
        message: "Handover already in progress",
        handover: existing,
        skipped: "exists",
      });
    }

    const project = await Project.findById(projectId)
      .select("name assignments")
      .populate("assignments.responsibilityId", "slug")
      .populate("assignments.users", "name email phone")
      .lean();
    if (!project) return res.status(404).json({ message: "Project not found" });

    const leadDesigner = await teamResolver.resolveFirstBySlug(project, "lead_designer");
    const projectSupervisor = await teamResolver.resolveFirstBySlug(project, "supervisor");

    // Build drawing snapshot
    const drawingFilter = { projectId };
    if (value.drawingIds?.length) {
      drawingFilter._id = { $in: value.drawingIds };
    } else {
      // Default — all released or approved drawings
      drawingFilter.status = { $in: ["released_to_site", "approved"] };
    }
    const drawings = await Drawing.find(drawingFilter)
      .select("_id title drawingType version")
      .lean();

    if (!drawings.length) {
      return res.status(400).json({
        code: "NO_DRAWINGS",
        message: "No drawings to hand over. Approve and release drawings first.",
      });
    }

    // Locate the gate seeded by Phase 1
    const gate = await ApprovalGate.findOne({ projectId, gateType: "gate_handover" }).lean();

    // Reset if rejected previously; otherwise create fresh
    const payload = {
      projectId,
      status: "requested",
      drawings: drawings.map((d) => ({
        drawingId: d._id,
        title: d.title,
        drawingType: d.drawingType,
        version: d.version,
        walked: false,
      })),
      punchList: existing?.punchList || [],
      designLeadId: (leadDesigner && leadDesigner._id) || req.user._id,
      supervisorId: value.supervisorId || (projectSupervisor && projectSupervisor._id) || undefined,
      notes: value.notes || "",
      gateId: gate?._id,
      createdBy: req.user._id,
    };

    let handover;
    if (existing) {
      Object.assign(existing, payload);
      handover = await existing.save();
    } else {
      handover = await HandoverPackage.create(payload);
    }

    try {
      await logActivity({
        projectId,
        actorId: req.user._id,
        entityType: "project",
        entityId: handover._id,
        action: "created",
        description: `Handover package opened with ${drawings.length} drawing(s)`,
      });
    } catch (e) { /* best-effort */ }

    try {
      notify({
        type: "handover.requested",
        module: "pms",
        priority: "high",
        title: `Handover requested: ${project.name}`,
        message: `${drawings.length} drawing(s) ready for site walkthrough.`,
        link: `/projects/${projectId}`,
        recipients: handover.supervisorId ? [handover.supervisorId] : [],
        relatedTo: { module: "pms", recordId: projectId },
        metadata: { handoverId: handover._id },
      });
    } catch (e) { /* best-effort */ }

    res.status(201).json({ message: "Handover requested", handover });
  } catch (err) {
    console.error("[requestHandover]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route GET /api/pms/handover/project/:projectId
 */
const getHandoverByProject = async (req, res) => {
  try {
    const handover = await HandoverPackage.findOne({ projectId: req.params.projectId })
      .populate("designLeadId", "name email")
      .populate("supervisorId", "name email")
      .populate("createdBy", "name")
      .populate("punchList.raisedBy", "name")
      .populate("punchList.resolvedBy", "name")
      .lean();
    res.json({ handover: handover || null });
  } catch (err) {
    console.error("[getHandoverByProject]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route PATCH /api/pms/handover/:id/drawings/:itemId
 */
const updateDrawingItem = async (req, res) => {
  try {
    const { error, value } = updateDrawingItemSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });

    const handover = await HandoverPackage.findById(req.params.id);
    if (!handover) return res.status(404).json({ message: "Handover not found" });
    if (handover.status === "accepted") {
      return res.status(409).json({ message: "Handover already accepted — drawing walkthrough is locked" });
    }

    const item = handover.drawings.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: "Drawing item not found" });

    item.walked = value.walked;
    item.walkedAt = value.walked ? new Date() : null;
    if (value.notes !== undefined) item.notes = value.notes;

    await handover.save();
    res.json({ message: "Walkthrough updated", item });
  } catch (err) {
    console.error("[updateDrawingItem]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route POST /api/pms/handover/:id/punch
 */
const addPunchItem = async (req, res) => {
  try {
    const { error, value } = addPunchItemSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });

    const handover = await HandoverPackage.findById(req.params.id);
    if (!handover) return res.status(404).json({ message: "Handover not found" });

    handover.punchList.push({
      description: value.description,
      severity: value.severity || "minor",
      raisedBy: req.user._id,
      raisedAt: new Date(),
    });
    await handover.save();
    res.status(201).json({ message: "Punch item added", handover });
  } catch (err) {
    console.error("[addPunchItem]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route PATCH /api/pms/handover/:id/punch/:punchId
 */
const resolvePunchItem = async (req, res) => {
  try {
    const { error, value } = resolvePunchItemSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });

    const handover = await HandoverPackage.findById(req.params.id);
    if (!handover) return res.status(404).json({ message: "Handover not found" });

    const item = handover.punchList.id(req.params.punchId);
    if (!item) return res.status(404).json({ message: "Punch item not found" });

    item.resolution = value.resolution;
    item.resolvedAt = new Date();
    item.resolvedBy = req.user._id;
    await handover.save();
    res.json({ message: "Punch item resolved", item });
  } catch (err) {
    console.error("[resolvePunchItem]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route POST /api/pms/handover/:id/sign
 * Design lead signoff. Requires all drawings walked AND all blocker punch items resolved.
 */
const designLeadSign = async (req, res) => {
  try {
    const { error, value } = designLeadSignSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });

    const handover = await HandoverPackage.findById(req.params.id);
    if (!handover) return res.status(404).json({ message: "Handover not found" });
    if (handover.status !== "requested") {
      return res.status(409).json({ message: `Cannot sign from status "${handover.status}"` });
    }

    const unwalked = handover.drawings.filter((d) => !d.walked).length;
    if (unwalked > 0) {
      return res.status(409).json({
        code: "WALKTHROUGH_INCOMPLETE",
        message: `${unwalked} drawing(s) not yet walked through.`,
      });
    }
    const unresolvedBlockers = handover.punchList.filter(
      (p) => p.severity === "blocker" && !p.resolvedAt
    ).length;
    if (unresolvedBlockers > 0) {
      return res.status(409).json({
        code: "BLOCKERS_OPEN",
        message: `${unresolvedBlockers} blocker punch item(s) unresolved.`,
      });
    }

    handover.status = "signed";
    handover.designLeadId = req.user._id;
    handover.designLeadSignedAt = new Date();
    handover.designLeadNotes = value.notes || "";
    await handover.save();

    try {
      notify({
        type: "handover.signed",
        module: "pms",
        priority: "high",
        title: `Handover signed by design lead`,
        message: `Awaiting supervisor acceptance.`,
        link: `/projects/${handover.projectId}`,
        recipients: handover.supervisorId ? [handover.supervisorId] : [],
        relatedTo: { module: "pms", recordId: handover.projectId },
      });
    } catch (e) { /* best-effort */ }

    res.json({ message: "Design lead signoff recorded", handover });
  } catch (err) {
    console.error("[designLeadSign]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route POST /api/pms/handover/:id/accept
 * Supervisor accept. Closes gate_handover and transitions Project.phase → execution.
 */
const supervisorAccept = async (req, res) => {
  try {
    const { error, value } = supervisorAcceptSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });

    const handover = await HandoverPackage.findById(req.params.id);
    if (!handover) return res.status(404).json({ message: "Handover not found" });
    if (handover.status !== "signed") {
      return res.status(409).json({ message: `Cannot accept from status "${handover.status}". Design lead must sign first.` });
    }

    handover.status = "accepted";
    handover.supervisorId = req.user._id;
    handover.supervisorAcceptedAt = new Date();
    handover.supervisorNotes = value.notes || "";
    await handover.save();

    // Engine cascade: close gate_handover, advance phase, recompute progress
    let cascade = null;
    if (WORKFLOW_ENGINE_V1 && handover.gateId) {
      try {
        cascade = await workflowEngine.closeGate(handover.gateId, { actorId: req.user._id });
        await workflowEngine.recomputeProjectPhase(handover.projectId);
        await workflowEngine.recomputeProjectProgress(handover.projectId);
      } catch (engineErr) {
        console.error("[supervisorAccept:engine]", engineErr);
      }
    }

    // Hard-set Project.phase = execution (in case the engine heuristic doesn't catch it)
    await Project.findByIdAndUpdate(handover.projectId, {
      $set: { phase: "execution", status: "execution_phase" },
    });

    // Mark the handover_signoff task as approved if it exists
    await Task.updateMany(
      { projectId: handover.projectId, taskType: "handover_signoff" },
      { $set: { status: "approved", approvedBy: req.user._id, approvedAt: new Date() } }
    );

    try {
      await logActivity({
        projectId: handover.projectId,
        actorId: req.user._id,
        entityType: "project",
        entityId: handover._id,
        action: "approved",
        description: "Handover accepted by supervisor — project moved to execution phase",
      });
    } catch (e) { /* best-effort */ }

    try {
      notify({
        type: "handover.accepted",
        module: "pms",
        priority: "high",
        title: `Handover accepted — site work can begin`,
        message: `Project transitioned to execution phase.`,
        link: `/projects/${handover.projectId}`,
        recipients: [handover.designLeadId, handover.createdBy].filter(Boolean),
        relatedTo: { module: "pms", recordId: handover.projectId },
      });
    } catch (e) { /* best-effort */ }

    res.json({ message: "Handover accepted — project in execution phase", handover, cascade });
  } catch (err) {
    console.error("[supervisorAccept]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route POST /api/pms/handover/:id/reject
 */
const supervisorReject = async (req, res) => {
  try {
    const { error, value } = supervisorRejectSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });

    const handover = await HandoverPackage.findById(req.params.id);
    if (!handover) return res.status(404).json({ message: "Handover not found" });
    if (handover.status === "accepted") {
      return res.status(409).json({ message: "Cannot reject an already-accepted handover" });
    }

    handover.status = "rejected";
    handover.supervisorId = req.user._id;
    handover.supervisorRejectedAt = new Date();
    handover.supervisorRejectionReason = value.rejectionReason;
    await handover.save();

    try {
      notify({
        type: "handover.rejected",
        module: "pms",
        priority: "high",
        title: `Handover rejected: ${value.rejectionReason}`,
        link: `/projects/${handover.projectId}`,
        recipients: [handover.designLeadId, handover.createdBy].filter(Boolean),
        relatedTo: { module: "pms", recordId: handover.projectId },
      });
    } catch (e) { /* best-effort */ }

    res.json({ message: "Handover rejected — back to design", handover });
  } catch (err) {
    console.error("[supervisorReject]", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  requestHandover,
  getHandoverByProject,
  updateDrawingItem,
  addPunchItem,
  resolvePunchItem,
  designLeadSign,
  supervisorAccept,
  supervisorReject,
};
