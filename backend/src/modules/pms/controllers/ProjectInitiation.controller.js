const mongoose = require("mongoose");
const Project  = require("../models/Project.model");
const Responsibility = require("../models/Responsibility.model");
const Proposal = require("../../crm/models/Proposal.model");
const CRMClient = require("../../crm/models/CRMClient.model");
const { logActivity } = require("../../../shared/activityLogger");
const workflowEngine = require("../services/workflowEngine");
const teamResolver = require("../services/teamResolver");

const WORKFLOW_ENGINE_V1 =
  String(process.env.WORKFLOW_ENGINE_V1 || "").toLowerCase() === "true";

const TEAM_POPULATE = teamResolver.assignmentsPopulate();

const ALLOWED_PROPOSAL_STATUSES = [
  "manager_approved",
  "sent",
  "esign_received",
  "payment_received",
  "project_ready",
  "project_started",
];

/**
 * @route POST /api/pms/project/initiate-from-proposal
 * Converts an approved proposal into a PMS project.
 * Transfers client + proposal data; manager fills remaining details.
 * Marks proposal as project_started and CRMClient as moved to PM.
 */
const initiateFromProposal = async (req, res) => {
  try {
    const {
      proposalId,
      name,
      notes,
      startDate,
      estimatedCompletionDate,
      budget,
      // Optional team pre-assignments from the initiation form.
      // Either provide the new shape: assignments: [{ responsibilityId, userIds: [] }]
      // or the legacy shape: leadDesignerId / supervisorId (for back-compat with
      // the existing proposal modal until it migrates).
      assignments,
      leadDesignerId,
      supervisorId,
    } = req.body;

    if (!proposalId || !mongoose.Types.ObjectId.isValid(proposalId)) {
      return res.status(400).json({ message: "Valid proposalId is required" });
    }

    if (startDate && estimatedCompletionDate) {
      const s = new Date(startDate);
      const e = new Date(estimatedCompletionDate);
      if (!isNaN(s) && !isNaN(e) && e <= s) {
        return res.status(400).json({ message: "End date must be after start date" });
      }
    }

    // 1. Fetch proposal + client
    const proposal = await Proposal.findById(proposalId)
      .populate("leadId")
      .lean();

    if (!proposal) {
      return res.status(404).json({ message: "Proposal not found" });
    }

    if (!ALLOWED_PROPOSAL_STATUSES.includes(proposal.status)) {
      return res.status(400).json({
        message: `Proposal must be approved before initiating a project. Current status: ${proposal.status}`,
      });
    }

    // 2. Check for duplicate project
    const existing = await Project.findOne({ proposalId }).lean();
    if (existing) {
      return res.status(409).json({
        message: "A project already exists for this proposal",
        projectId: existing._id,
        trackingId: existing.trackingId,
      });
    }

    const client = proposal.leadId;
    if (!client) {
      return res.status(400).json({ message: "Proposal has no linked client" });
    }

    // 3. Build project payload — transfer everything from proposal/client
    const projectName =
      name ||
      `${client.name} — ${client.projectType || "Interior"} Project`;

    const siteAddress = {
      fullAddress:  client.siteAddress?.fullAddress || client.address || projectName,
      buildingName: client.siteAddress?.buildingName || "",
      tower:        client.siteAddress?.tower || "",
      unit:         client.siteAddress?.unit || "",
      floor:        client.siteAddress?.floor || "",
      city:         client.siteAddress?.city || client.city || "",
    };

    const projectPayload = {
      clientId:    client._id,
      proposalId:  proposal._id,
      name:        projectName,
      projectType: client.projectType || "Residential",
      siteAddress,
      area:        client.area || undefined,
      budget:      Number(budget) > 0
        ? Number(budget)
        : (proposal.finalAmount || proposal.totalAmount || client.budget || undefined),
      notes:       notes || "",
      estimatedCompletionDate: estimatedCompletionDate || undefined,
      startDate:   startDate ? new Date(startDate) : new Date(),
    };

    // Optional team pre-assignments — prefer the new shape if provided,
    // else translate the legacy lead/supervisor IDs via slug lookup.
    let resolvedAssignments = [];
    if (Array.isArray(assignments) && assignments.length) {
      resolvedAssignments = assignments
        .filter((a) => mongoose.Types.ObjectId.isValid(a.responsibilityId))
        .map((a) => ({
          responsibilityId: a.responsibilityId,
          users: Array.isArray(a.userIds)
            ? a.userIds.filter((u) => mongoose.Types.ObjectId.isValid(u))
            : [],
        }));
    } else if (leadDesignerId || supervisorId) {
      const seedSlugs = [];
      if (leadDesignerId && mongoose.Types.ObjectId.isValid(leadDesignerId))
        seedSlugs.push({ slug: "lead_designer", userId: leadDesignerId });
      if (supervisorId && mongoose.Types.ObjectId.isValid(supervisorId))
        seedSlugs.push({ slug: "supervisor", userId: supervisorId });

      if (seedSlugs.length) {
        const respDocs = await Responsibility.find({
          slug: { $in: seedSlugs.map((s) => s.slug) },
        }).select("_id slug").lean();
        const bySlug = new Map(respDocs.map((r) => [r.slug, r._id]));
        for (const s of seedSlugs) {
          const respId = bySlug.get(s.slug);
          if (respId) resolvedAssignments.push({ responsibilityId: respId, users: [s.userId] });
        }
      }
    }
    if (resolvedAssignments.length) projectPayload.assignments = resolvedAssignments;

    // 4. Create project
    const project = await Project.create(projectPayload);

    // 5. Mark proposal as project_started
    await Proposal.findByIdAndUpdate(proposalId, {
      status: "project_started",
    });

    // 6. Mark CRMClient as moved to project management
    await CRMClient.findByIdAndUpdate(client._id, {
      $set: {
        "advancePayment.movedToProjectManagement": true,
        "advancePayment.movedAt": new Date(),
        lifecycleStage: "project_started",
      },
      $push: {
        interactionHistory: {
          type:        "project",
          title:       "Project Initiated",
          description: `PMS Project "${project.name}" (${project.trackingId}) created from proposal`,
          metadata:    { projectId: project._id, proposalId: proposal._id },
          createdAt:   new Date(),
        },
      },
    });

    // 7. Activity log
    logActivity({
      projectId:   project._id,
      actorId:     req.user._id,
      entityType:  "project",
      entityId:    project._id,
      action:      "created",
      description: `Project "${project.name}" initiated from proposal ${proposal._id}`,
      metadata:    { proposalId: proposal._id, clientId: client._id },
    });

    // 7b. Workflow Engine — auto-seed the PDF-accurate task graph (Phase 1)
    // Behind WORKFLOW_ENGINE_V1 env flag for safe rollout. Best-effort: failures
    // are logged but do not block project creation.
    let workflowSummary = null;
    if (WORKFLOW_ENGINE_V1) {
      try {
        workflowSummary = await workflowEngine.seedProject(project._id, {
          actorId: req.user._id,
        });
      } catch (engineErr) {
        console.error("[ProjectInitiation:workflowEngine] seed failed:", engineErr);
        // Do not throw — project is created even if engine fails.
      }
    }

    // 8. Populate and return
    const populated = await Project.findById(project._id)
      .populate("clientId",   "name phone email trackingId")
      .populate("proposalId", "title totalAmount finalAmount")
      .populate(TEAM_POPULATE);

    res.status(201).json({
      message: "Project initiated successfully",
      project: populated,
      workflow: workflowSummary,
    });
  } catch (err) {
    console.error("[initiateFromProposal]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route GET /api/pms/project/proposal-preview/:proposalId
 * Returns proposal + client data pre-populated for the initiation form.
 */
const getProposalPreview = async (req, res) => {
  try {
    const { proposalId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(proposalId)) {
      return res.status(400).json({ message: "Invalid proposalId" });
    }

    const proposal = await Proposal.findById(proposalId)
      .populate("leadId")
      .populate("boqId")
      .lean();

    if (!proposal) {
      return res.status(404).json({ message: "Proposal not found" });
    }

    // Check for existing project
    const existingProject = await Project.findOne({ proposalId }).lean();

    res.status(200).json({ proposal, existingProject: existingProject || null });
  } catch (err) {
    console.error("[getProposalPreview]", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { initiateFromProposal, getProposalPreview };
