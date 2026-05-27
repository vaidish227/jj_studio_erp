// Write tool: approve a drawing that's been submitted for review.
// Mirrors PATCH /api/pms/drawing/approve/:id. Source status must be
// 'sent_for_approval'. Requires drawings.approve.

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
      summaryText: `Drawing is "${drawing.status}" — only drawings in 'sent_for_approval' can be approved.` } };
  }
  return { drawing };
}

module.exports = {
  name: "approveDrawing",
  permission: "drawings.approve",
  isWrite: true,
  description:
    "Approve a drawing that's currently in 'sent_for_approval'. Records who approved and when. Use when the user says 'approve drawing X', 'sign off on the kitchen drawing', etc. After approval the drawing can be released to site.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      drawingId: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
      remarks:   { type: "string", maxLength: 1000, description: "Optional approval remarks." },
    },
    required: ["drawingId"],
  },

  async dryRun(args) {
    const r = await loadAndAuthorize(args);
    if (r.error) return r.error;
    return {
      ok: true,
      proposalDescription:
        `Approve drawing "${r.drawing.title}" (v${r.drawing.version})` +
        (args.remarks ? ` — remarks: ${args.remarks.slice(0, 120)}` : ""),
      args,
      preview: {
        drawingTitle: r.drawing.title,
        version: r.drawing.version,
        drawingType: r.drawing.drawingType,
        from: r.drawing.status,
        to: "approved",
        remarks: args.remarks || null,
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
          status: "approved",
          approvedBy: new mongoose.Types.ObjectId(ctx.userId),
          approvalDate: new Date(),
          remarks: args.remarks || "",
        },
      }
    );

    logActivity({
      projectId: d.projectId,
      actorId: ctx.userId,
      entityType: "drawing",
      entityId: d._id,
      action: "approved",
      description: `[AI] Drawing "${d.title}" approved`,
      metadata: { remarks: args.remarks || null, viaAI: true },
    });

    return {
      ok: true,
      summaryText: `Approved drawing "${d.title}".`,
      uiHint: "actionDone",
      data: { drawingId: String(d._id), title: d.title, status: "approved",
              url: `/projects/${d.projectId}` },
    };
  },
};
