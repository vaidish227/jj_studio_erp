// Tool: free-text search projects by name fragment or trackingId fragment,
// optionally filter by status / projectType / designer scope. Permission-aware —
// users without projects.read see only projects they're on (designer/supervisor).

const mongoose = require("mongoose");
const Project = require("../../pms/models/Project.model");

const WIDER_PERMS = ["*", "projects.read", "projects.update"];

function hasWider(permissions = []) {
  return permissions.some((p) => WIDER_PERMS.includes(p));
}

module.exports = {
  name: "searchProjects",
  permission: "tasks.read", // baseline — narrows further inside the handler
  description:
    "Search for projects by name fragment, trackingId fragment, status, or project type. Use for 'find projects with kitchen in name', 'show all design-phase projects', 'projects in PRJ-2025'. If the caller has projects.read they see all matches; otherwise only projects where they're on the team.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      query: {
        type: "string",
        description: "Optional case-insensitive substring matched against name OR trackingId.",
      },
      status: {
        type: "string",
        enum: ["design_phase", "execution_phase", "handover", "completed", "on_hold", "cancelled", "all"],
      },
      projectType: { type: "string", enum: ["Residential", "Commercial"] },
      scope: {
        type: "string",
        enum: ["me", "all"],
        description: "'me' = projects I'm on the team of (default). 'all' = every project (requires projects.read).",
      },
      limit: { type: "integer", minimum: 1, maximum: 30 },
    },
    required: [],
  },

  handler: async (args, ctx) => {
    const canSeeAll = hasWider(ctx.permissions);
    const scope = args.scope || (canSeeAll ? "all" : "me");
    const limit = Math.min(args.limit || 15, 30);

    const q = {};

    // Permission-aware scoping
    if (scope === "all") {
      if (!canSeeAll) {
        return {
          ok: false,
          error: "denied",
          summaryText: "You don't have permission to search all projects. Try scope='me' instead.",
          uiHint: "error",
        };
      }
    } else {
      // 'me' — restrict to projects where the user is on the team
      const me = new mongoose.Types.ObjectId(ctx.userId);
      q.$or = [
        { primaryDesigner: me },
        { supervisor: me },
        { designerB: me },
        { designerC: me },
        { designerD: me },
        { designerE: me },
        { contractor: me },
      ];
    }

    if (args.status && args.status !== "all") q.status = args.status;
    if (args.projectType) q.projectType = args.projectType;

    if (args.query?.trim()) {
      const term = String(args.query).trim().slice(0, 60);
      const re = new RegExp(escapeRegex(term), "i");
      const textOr = [{ name: re }, { trackingId: re }];
      // Combine with the scope $or if present.
      if (q.$or) {
        q.$and = [{ $or: q.$or }, { $or: textOr }];
        delete q.$or;
      } else {
        q.$or = textOr;
      }
    }

    const projects = await Project.find(q)
      .select("trackingId name status projectType area budget primaryDesigner supervisor updatedAt")
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    const items = projects.map((p) => ({
      id: String(p._id),
      trackingId: p.trackingId,
      name: p.name,
      status: p.status,
      projectType: p.projectType,
      area: p.area,
      budget: p.budget,
      url: `/projects/${p._id}`,
    }));

    return {
      data: items,
      summaryText:
        items.length === 0
          ? "No projects matched."
          : `${items.length} project${items.length === 1 ? "" : "s"}${args.query ? ` matching "${args.query}"` : ""}`,
      uiHint: "projectList",
      llmSummary: items.slice(0, 10).map((p) => ({
        trackingId: p.trackingId,
        name: p.name,
        status: p.status,
        projectType: p.projectType,
      })),
    };
  },
};

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
