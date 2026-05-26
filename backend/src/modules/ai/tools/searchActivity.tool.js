// Tool: read the PMSActivityLog audit trail. Answers "what changed yesterday",
// "who reassigned task X", "recent activity on project ABC".

const mongoose = require("mongoose");
const PMSActivityLog = require("../../pms/models/PMSActivityLog.model");
const Project = require("../../pms/models/Project.model");
const User = require("../../auth/models/user.model");

const WIDER_PERMS = ["*", "activity.read", "projects.read"];

function hasWider(permissions = []) {
  return permissions.some((p) => WIDER_PERMS.includes(p));
}

const RANGE_TO_MS = {
  today:    1 * 24 * 60 * 60 * 1000,
  "24h":    1 * 24 * 60 * 60 * 1000,
  "3d":     3 * 24 * 60 * 60 * 1000,
  week:     7 * 24 * 60 * 60 * 1000,
  "2w":    14 * 24 * 60 * 60 * 1000,
  month:   30 * 24 * 60 * 60 * 1000,
};

module.exports = {
  name: "searchActivity",
  permission: "activity.read",
  description:
    "Search the project activity log. Use for 'what changed yesterday', 'recent activity on project X', 'who approved task Y', 'show updates in the last week'. Defaults to activity I performed; pass scope='all' (requires activity.read or projects.read) for everyone's actions.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      projectId: {
        type: "string",
        description: "Optional MongoDB ObjectId OR trackingId (PRJ-YYYY-NNNN) to scope to one project.",
      },
      entityType: {
        type: "string",
        enum: ["project", "task", "drawing", "milestone", "approval", "material", "purchase_order", "site_visit", "site_log", "whatsapp_group", "all"],
      },
      action: {
        type: "string",
        enum: ["created", "updated", "deleted", "status_changed", "assigned", "unassigned", "approved", "rejected", "released", "sent_for_approval", "revision_requested", "commented", "checklist_updated", "team_updated", "kickstart_updated", "all"],
      },
      range: {
        type: "string",
        enum: ["today", "24h", "3d", "week", "2w", "month"],
        description: "Time window. Default '3d'.",
      },
      scope: {
        type: "string",
        enum: ["me", "all"],
        description: "'me' = activity I performed (default). 'all' = everyone (requires activity.read).",
      },
      limit: { type: "integer", minimum: 1, maximum: 30 },
    },
    required: [],
  },

  handler: async (args, ctx) => {
    const canSeeAll = hasWider(ctx.permissions);
    const scope = args.scope || (canSeeAll ? "all" : "me");
    const limit = Math.min(args.limit || 15, 30);
    const rangeMs = RANGE_TO_MS[args.range || "3d"];
    const since = new Date(Date.now() - rangeMs);

    const q = { createdAt: { $gte: since } };

    if (scope === "all") {
      if (!canSeeAll) {
        return {
          ok: false,
          error: "denied",
          summaryText: "You don't have permission to view team-wide activity. Try scope='me'.",
          uiHint: "error",
        };
      }
    } else {
      q.actorId = new mongoose.Types.ObjectId(ctx.userId);
    }

    if (args.entityType && args.entityType !== "all") q.entityType = args.entityType;
    if (args.action     && args.action     !== "all") q.action     = args.action;

    if (args.projectId) {
      const pid = await resolveProjectId(args.projectId);
      if (!pid) {
        return { ok: false, error: "not_found", summaryText: "Project not found.", uiHint: "error" };
      }
      q.projectId = pid;
    }

    const logs = await PMSActivityLog.find(q)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const projectIds = [...new Set(logs.filter((l) => l.projectId).map((l) => String(l.projectId)))];
    const actorIds   = [...new Set(logs.filter((l) => l.actorId).map((l) => String(l.actorId)))];

    const [projects, actors] = await Promise.all([
      projectIds.length ? Project.find({ _id: { $in: projectIds } }).select("trackingId name").lean() : [],
      actorIds.length   ? User.find({ _id: { $in: actorIds } }).select("name role").lean()           : [],
    ]);
    const projectById = new Map(projects.map((p) => [String(p._id), p]));
    const actorById   = new Map(actors.map((u) => [String(u._id), u]));

    const items = logs.map((l) => ({
      id: String(l._id),
      entityType: l.entityType,
      action: l.action,
      description: l.description,
      at: l.createdAt,
      actor: actorById.get(String(l.actorId)) || null,
      project: projectById.get(String(l.projectId)) || null,
      url: l.projectId ? `/projects/${l.projectId}` : null,
    }));

    return {
      data: items,
      summaryText:
        items.length === 0
          ? "No activity in that window."
          : `${items.length} activity entr${items.length === 1 ? "y" : "ies"} in last ${args.range || "3d"}`,
      uiHint: "activityList",
      llmSummary: items.slice(0, 12).map((l) => ({
        when: l.at,
        actor: l.actor?.name,
        action: `${l.action} ${l.entityType}`,
        project: l.project?.trackingId,
        description: l.description?.slice(0, 120),
      })),
    };
  },
};

async function resolveProjectId(input) {
  const s = String(input || "").trim();
  if (!s) return null;
  if (mongoose.isValidObjectId(s)) return new mongoose.Types.ObjectId(s);
  const p = await Project.findOne({ trackingId: s }).select("_id").lean();
  return p?._id || null;
}
