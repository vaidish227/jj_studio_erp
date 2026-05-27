// Write tool: release an approved drawing to site. Mirrors the existing
// PATCH /api/pms/drawing/release/:id, including cascading the parent task
// status to 'released_to_site'.

const mongoose = require("mongoose");
const Drawing = require("../../pms/models/Drawing.model");
const Task = require("../../pms/models/Task.model");
const { logActivity } = require("../../../shared/activityLogger");

async function loadAndAuthorize(args) {
  if (!mongoose.isValidObjectId(args.drawingId)) {
    return { error: { ok: false, error: "invalid_args", summaryText: "Invalid drawing ID." } };
  }
  const drawing = await Drawing.findById(args.drawingId).lean();
  if (!drawing) {
    return { error: { ok: false, error: "not_found", summaryText: "Drawing not found." } };
  }
  if (drawing.status !== "approved") {
    return { error: { ok: false, error: "invalid_transition",
      summaryText: `Drawing is "${drawing.status}" — only approved drawings can be released to site.` } };
  }
  return { drawing };
}

module.exports = {
  name: "releaseDrawing",
  permission: "drawings.release",
  isWrite: true,
  description:
    "Release an approved drawing to the site/execution team. Sets isReleased=true and status='released_to_site'. Also propagates 'released_to_site' to the parent task. Only valid for drawings currently in 'approved' status.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      drawingId: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
    },
    required: ["drawingId"],
  },

  async dryRun(args) {
    const r = await loadAndAuthorize(args);
    if (r.error) return r.error;
    return {
      ok: true,
      proposalDescription:
        `Release drawing "${r.drawing.title}" (v${r.drawing.version}) to site — this will also cascade the parent task to 'released_to_site'.`,
      args,
      preview: {
        drawingTitle: r.drawing.title,
        version: r.drawing.version,
        from: r.drawing.status,
        to: "released_to_site",
        cascadesToTask: !!r.drawing.taskId,
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
          status: "released_to_site",
          isReleased: true,
          releasedAt: new Date(),
          releasedBy: new mongoose.Types.ObjectId(ctx.userId),
        },
      }
    );

    if (d.taskId) {
      await Task.updateOne({ _id: d.taskId }, { $set: { status: "released_to_site" } });
    }

    logActivity({
      projectId: d.projectId,
      actorId: ctx.userId,
      entityType: "drawing",
      entityId: d._id,
      action: "released",
      description: `[AI] Drawing "${d.title}" released to site`,
      metadata: { cascadedTaskId: d.taskId || null, viaAI: true },
    });

    return {
      ok: true,
      summaryText: `Released drawing "${d.title}" to site.`,
      uiHint: "actionDone",
      data: { drawingId: String(d._id), title: d.title, status: "released_to_site",
              url: `/projects/${d.projectId}` },
    };
  },
};
