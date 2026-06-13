// Write tool: change a project's lifecycle status. Transitions are validated
// against the standard PMS workflow. Moving to execution_phase warns if the
// kickstart isn't completed (but doesn't block — admin override).

const mongoose = require("mongoose");
const Project = require("../../pms/models/Project.model");
const { logActivity } = require("../../../shared/activityLogger");

// Forward path: design → execution → handover → completed. on_hold/cancelled
// allowed from anywhere active.
const ALLOWED_TRANSITIONS = {
  design_phase:    ["execution_phase", "on_hold", "cancelled"],
  execution_phase: ["handover", "on_hold", "cancelled"],
  handover:        ["completed", "on_hold"],
  completed:       [],
  on_hold:         ["design_phase", "execution_phase", "handover"],
  cancelled:       [],
};

const WIDER_PERMS = ["*", "projects.update"];

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
      summaryText: "Only project team members (or admin) can change this project's status." } };
  }

  const from = project.status;
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(args.status)) {
    return { error: { ok: false, error: "invalid_transition",
      summaryText: `Cannot move project from "${from}" → "${args.status}". Allowed: ${allowed.join(", ") || "(closed — no further transitions)"}.` } };
  }
  if ((args.status === "on_hold" || args.status === "cancelled") && !args.reason?.trim()) {
    return { error: { ok: false, error: "invalid_args",
      summaryText: `Moving to "${args.status}" requires a reason.` } };
  }

  return { project };
}

module.exports = {
  name: "updateProjectStatus",
  permission: "projects.update",
  isWrite: true,
  description:
    "Change a project's lifecycle status (design_phase → execution_phase → handover → completed, or to on_hold/cancelled). Validates legal transitions. on_hold and cancelled require a reason.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      projectId: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
      status: {
        type: "string",
        enum: ["design_phase", "execution_phase", "handover", "completed", "on_hold", "cancelled"],
      },
      reason: { type: "string", maxLength: 500 },
    },
    required: ["projectId", "status"],
  },

  async dryRun(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;
    const warnKickstart =
      args.status === "execution_phase" && !r.project.kickstartCompleted
        ? "\n⚠ Kickstart isn't completed — confirm you really want to move forward."
        : "";
    return {
      ok: true,
      proposalDescription:
        `Change project ${r.project.trackingId} (${r.project.name}) status: ${r.project.status} → ${args.status}` +
        (args.reason ? ` · reason: ${args.reason}` : "") +
        warnKickstart,
      args,
      preview: {
        trackingId: r.project.trackingId,
        name: r.project.name,
        from: r.project.status,
        to: args.status,
        reason: args.reason || null,
        kickstartWarning: !!warnKickstart,
      },
    };
  },

  async apply(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;
    const p = r.project;

    const update = { status: args.status };
    if (args.status === "completed") update.actualCompletionDate = new Date();

    await Project.updateOne({ _id: p._id }, { $set: update });

    logActivity({
      projectId: p._id,
      actorId: ctx.userId,
      entityType: "project",
      entityId: p._id,
      action: "status_changed",
      description: `[AI] Project ${p.trackingId} (${p.name}) — ${p.status} → ${args.status}` +
        (args.reason ? ` (${args.reason})` : ""),
      metadata: { from: p.status, to: args.status, reason: args.reason || null, viaAI: true },
    });

    return {
      ok: true,
      summaryText: `Project ${p.trackingId} is now ${args.status}.`,
      uiHint: "actionDone",
      data: { projectId: String(p._id), trackingId: p.trackingId, name: p.name,
              status: args.status, url: `/projects/${p._id}` },
    };
  },
};
