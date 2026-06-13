// Write tool: update one of the 6 mandatory client-approval entries on a
// project (ac, automation, kitchen, bathroom_material, cp_fittings,
// wall_floor_material). Used to mark them obtained / not_applicable.

const mongoose = require("mongoose");
const Project = require("../../pms/models/Project.model");
const { logActivity } = require("../../../shared/activityLogger");

const APPROVAL_TYPES = [
  "ac", "automation", "kitchen", "bathroom_material", "cp_fittings", "wall_floor_material",
];

const WIDER_PERMS = ["*", "projects.update", "approvals.respond"];

function hasWider(permissions = []) {
  return permissions.some((p) => WIDER_PERMS.includes(p));
}

async function loadAndAuthorize(args, ctx) {
  if (!mongoose.isValidObjectId(args.projectId)) {
    return { error: { ok: false, error: "invalid_args", summaryText: "Invalid project ID." } };
  }
  const project = await Project.findById(args.projectId).lean();
  if (!project) {
    return { error: { ok: false, error: "not_found", summaryText: "Project not found." } };
  }

  const onTeam = [
    project.primaryDesigner, project.supervisor,
    project.designerB, project.designerC, project.designerD, project.designerE,
    project.contractor,
  ].some((id) => String(id || "") === String(ctx.userId));
  const elevated = hasWider(ctx.permissions);
  if (!onTeam && !elevated) {
    return { error: { ok: false, error: "denied",
      summaryText: "Only project team members (or admin) can update client approvals." } };
  }

  const existing = (project.clientApprovals || []).find((a) => a.type === args.type);
  return { project, existing };
}

module.exports = {
  name: "updateClientApproval",
  permission: "projects.update",
  isWrite: true,
  description:
    "Mark a project's client approval as obtained or not_applicable (or back to pending). Approval types: ac, automation, kitchen, bathroom_material, cp_fittings, wall_floor_material. If the approval entry doesn't exist yet it will be created.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      projectId: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
      type:      { type: "string", enum: APPROVAL_TYPES },
      status:    { type: "string", enum: ["pending", "obtained", "not_applicable"] },
      notes:     { type: "string", maxLength: 500 },
    },
    required: ["projectId", "type", "status"],
  },

  async dryRun(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;
    const fromStatus = r.existing?.status || "pending (new entry)";
    return {
      ok: true,
      proposalDescription:
        `Update project ${r.project.trackingId} approval — ${args.type}: ${fromStatus} → ${args.status}` +
        (args.notes ? ` · notes: ${args.notes.slice(0, 120)}` : ""),
      args,
      preview: {
        trackingId: r.project.trackingId,
        type: args.type,
        from: fromStatus,
        to: args.status,
        notes: args.notes || null,
      },
    };
  },

  async apply(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;
    const p = r.project;

    const setFields = {
      "clientApprovals.$[el].status": args.status,
      "clientApprovals.$[el].notes": args.notes || "",
    };
    if (args.status === "obtained") setFields["clientApprovals.$[el].obtainedAt"] = new Date();

    let updateRes;
    if (r.existing) {
      updateRes = await Project.updateOne(
        { _id: p._id },
        { $set: setFields },
        { arrayFilters: [{ "el.type": args.type }] }
      );
    } else {
      // Create the entry — no array filter needed
      updateRes = await Project.updateOne(
        { _id: p._id },
        {
          $push: {
            clientApprovals: {
              type: args.type,
              status: args.status,
              obtainedAt: args.status === "obtained" ? new Date() : undefined,
              notes: args.notes || "",
            },
          },
        }
      );
    }

    logActivity({
      projectId: p._id,
      actorId: ctx.userId,
      entityType: "approval",
      entityId: p._id,
      action: args.status === "obtained" ? "approved" : "updated",
      description: `[AI] Project ${p.trackingId} approval "${args.type}" → ${args.status}`,
      metadata: { type: args.type, status: args.status, notes: args.notes || null, viaAI: true },
    });

    return {
      ok: true,
      summaryText: `Updated ${args.type} approval on ${p.trackingId} to ${args.status}.`,
      uiHint: "actionDone",
      data: { projectId: String(p._id), trackingId: p.trackingId,
              approvalType: args.type, status: args.status,
              url: `/projects/${p._id}` },
    };
  },
};
