// Write tool: reject a drawing under review with a required reason.
// Mirrors PATCH /api/pms/drawing/reject/:id. Sets status='rejected'.

const mongoose = require("mongoose");
const Drawing = require("../../pms/models/Drawing.model");
const { logActivity } = require("../../../shared/activityLogger");

async function loadAndAuthorize(args) {
  if (!mongoose.isValidObjectId(args.drawingId)) {
    return { error: { ok: false, error: "invalid_args", summaryText: "Invalid drawing ID." } };
  }
  const drawing = await Drawing.findById(args.drawingId).lean();
  if (!drawing) {
    return { error: { ok: false, error: "not_found", summaryText: "Drawing not found." } };
  }
  if (drawing.status !== "sent_for_approval") {
    return { error: { ok: false, error: "invalid_transition",
      summaryText: `Drawing is "${drawing.status}" — only drawings in 'sent_for_approval' can be rejected.` } };
  }
  return { drawing };
}

module.exports = {
  name: "rejectDrawing",
  permission: "drawings.approve",
  isWrite: true,
  description:
    "Reject a drawing that's under review with a required reason. The designer can then upload a revised version. Use when the user says 'reject drawing X', 'send back the kitchen drawing because…'. Different from requestTaskRevision (that's task-level).",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      drawingId:       { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
      rejectionReason: { type: "string", minLength: 5, maxLength: 1000 },
    },
    required: ["drawingId", "rejectionReason"],
  },

  async dryRun(args) {
    const r = await loadAndAuthorize(args);
    if (r.error) return r.error;
    return {
      ok: true,
      proposalDescription:
        `Reject drawing "${r.drawing.title}" (v${r.drawing.version}) — reason: ${args.rejectionReason.slice(0, 160)}${args.rejectionReason.length > 160 ? "…" : ""}`,
      args,
      preview: {
        drawingTitle: r.drawing.title,
        version: r.drawing.version,
        from: r.drawing.status,
        to: "rejected",
        rejectionReason: args.rejectionReason,
      },
    };
  },

  async apply(args, ctx) {
    const r = await loadAndAuthorize(args);
    if (r.error) return r.error;
    const d = r.drawing;
    await Drawing.updateOne(
      { _id: d._id },
      {
        $set: {
          status: "rejected",
          rejectedBy: new mongoose.Types.ObjectId(ctx.userId),
          rejectedAt: new Date(),
          rejectionReason: args.rejectionReason,
        },
      }
    );

    logActivity({
      projectId: d.projectId,
      actorId: ctx.userId,
      entityType: "drawing",
      entityId: d._id,
      action: "rejected",
      description: `[AI] Drawing "${d.title}" rejected — ${args.rejectionReason.slice(0, 200)}`,
      metadata: { rejectionReason: args.rejectionReason, viaAI: true },
    });

    return {
      ok: true,
      summaryText: `Rejected drawing "${d.title}".`,
      uiHint: "actionDone",
      data: { drawingId: String(d._id), title: d.title, status: "rejected",
              url: `/projects/${d.projectId}` },
    };
  },
};
