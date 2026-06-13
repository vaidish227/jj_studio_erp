// Write tool: reassign a task to a different user. Requires tasks.reassign.
// We accept either a userId OR a name fragment (model can pass "Rahul" and we
// resolve it in dryRun — failing cleanly if the name is ambiguous).

const mongoose = require("mongoose");
const Task = require("../../pms/models/Task.model");
const User = require("../../auth/models/user.model");
const { logActivity } = require("../../../shared/activityLogger");
const { dispatch: notify } = require("../../notifications/services/notificationDispatcher");

async function resolveAssignee(args) {
  if (args.toUserId && mongoose.isValidObjectId(args.toUserId)) {
    const u = await User.findById(args.toUserId).select("name email role isActive").lean();
    return u && u.isActive !== false ? { user: u } : { error: "User not found or inactive." };
  }
  if (args.toUserName?.trim()) {
    const term = String(args.toUserName).trim().slice(0, 60);
    const re = new RegExp(escapeRegex(term), "i");
    const candidates = await User.find({
      isActive: { $ne: false },
      $or: [{ name: re }, { email: re }],
    }).select("name email role").limit(5).lean();
    if (candidates.length === 0) return { error: `No active user matches "${term}".` };
    if (candidates.length > 1) {
      const names = candidates.map((c) => c.name).join(", ");
      return { error: `Ambiguous — multiple users match "${term}": ${names}. Be more specific.` };
    }
    return { user: candidates[0] };
  }
  return { error: "Provide either toUserId or toUserName." };
}

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

async function loadAndAuthorize(args, ctx) {
  if (!mongoose.isValidObjectId(args.taskId)) {
    return { error: { ok: false, error: "invalid_args", summaryText: "Invalid task ID." } };
  }
  const task = await Task.findById(args.taskId).lean();
  if (!task) return { error: { ok: false, error: "not_found", summaryText: "Task not found." } };

  const assignee = await resolveAssignee(args);
  if (assignee.error) {
    return { error: { ok: false, error: "invalid_args", summaryText: assignee.error } };
  }
  if (String(task.assignedTo || "") === String(assignee.user._id)) {
    return { error: { ok: false, error: "no_op",
      summaryText: `Task is already assigned to ${assignee.user.name}.` } };
  }
  return { task, toUser: assignee.user };
}

module.exports = {
  name: "reassignTask",
  permission: "tasks.reassign",
  isWrite: true,
  description:
    "Reassign a task to a different user. Pass toUserId (preferred) or toUserName as a name fragment — the tool will refuse if the name matches more than one active user. The current assignee is recorded as reassignedFrom for audit.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      taskId:     { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
      toUserId:   { type: "string", pattern: "^[a-fA-F0-9]{24}$", description: "Preferred — exact target user ObjectId." },
      toUserName: { type: "string", minLength: 2, maxLength: 60, description: "Fallback — partial name/email match." },
      reason:     { type: "string", minLength: 3, maxLength: 500 },
    },
    required: ["taskId", "reason"],
  },

  async dryRun(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;
    return {
      ok: true,
      proposalDescription: `Reassign "${r.task.title}" → ${r.toUser.name} (${r.toUser.role})` +
        ` · reason: ${args.reason}`,
      args: { ...args, toUserId: String(r.toUser._id) }, // canonicalise to id
      preview: {
        taskTitle: r.task.title,
        fromUserId: r.task.assignedTo ? String(r.task.assignedTo) : null,
        toUser: { id: String(r.toUser._id), name: r.toUser.name, role: r.toUser.role },
        reason: args.reason,
      },
    };
  },

  async apply(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;
    const t = r.task;
    await Task.updateOne(
      { _id: t._id },
      {
        $set: {
          assignedTo: new mongoose.Types.ObjectId(r.toUser._id),
          reassignedFrom: t.assignedTo || null,
          reassignedAt: new Date(),
          reassignedReason: args.reason,
        },
      }
    );

    logActivity({
      projectId: t.projectId,
      actorId: ctx.userId,
      entityType: "task",
      entityId: t._id,
      action: "assigned",
      description: `[AI] ${t.title} reassigned to ${r.toUser.name} — ${args.reason}`,
      metadata: { fromUserId: t.assignedTo, toUserId: r.toUser._id, reason: args.reason, viaAI: true },
    });

    notify({
      type: "task.assigned",
      module: "pms",
      priority: "high",
      title: `Task reassigned to you: ${t.title}`,
      message: args.reason ? `${args.reason} (via AI assistant).` : "Reassigned via AI assistant.",
      link: `/tasks/${t._id}`,
      recipients: [r.toUser._id],
      actor: { _id: ctx.userId, name: ctx.userName || "AI Assistant" },
      notifyActor: true,
      relatedTo: { module: "pms", recordId: t._id },
      metadata: { taskTitle: t.title, viaAI: true, fromUserId: t.assignedTo, toUserId: r.toUser._id },
    });

    return {
      ok: true,
      summaryText: `Reassigned "${t.title}" to ${r.toUser.name}.`,
      uiHint: "actionDone",
      data: {
        taskId: String(t._id),
        title: t.title,
        assignee: { id: String(r.toUser._id), name: r.toUser.name },
        url: `/projects/${t.projectId}?taskId=${t._id}`,
      },
    };
  },
};
