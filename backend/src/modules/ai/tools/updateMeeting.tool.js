// Write tool: reschedule or edit a Meeting — date, type, notes, duration,
// or assignee. Does NOT change status — use completeMeeting for that, since
// status transitions drive cascading lead-lifecycle automation in the
// controller and must go through the dedicated tool.

const mongoose = require("mongoose");
const Meeting = require("../../crm/models/Metting.model");
const CRMClient = require("../../crm/models/CRMClient.model");
const { resolveMeeting } = require("../utils/resolveCrm");
const { dispatch: notify } = require("../../notifications/services/notificationDispatcher");

const WIDER_PERMS = ["*", "crm.update"];
const MEETING_TYPES = ["call", "office", "site"];

// Whitelisted fields the AI can touch via this tool. Excludes status,
// clientInterested, outcome, followUpDate, mom — all gated to completeMeeting
// or recordMOM so the lead-lifecycle workflow stays correct.
const UPDATABLE_FIELDS = ["date", "type", "notes", "durationMinutes", "assignedTo"];

async function loadAndAuthorize(args, ctx) {
  const r = await resolveMeeting(args.meetingId);
  if (r.error) {
    return { error: { ok: false, error: "not_found", summaryText: r.error, uiHint: "error" } };
  }
  const meeting = r.doc;
  const isOwner = String(meeting.assignedTo || "") === String(ctx.userId)
                || String(meeting.createdBy || "") === String(ctx.userId);
  const elevated = (ctx.permissions || []).some((p) => WIDER_PERMS.includes(p));
  if (!isOwner && !elevated) {
    return { error: { ok: false, error: "denied", uiHint: "error",
      summaryText: "Only the assigned staff (or admin) can edit this meeting." } };
  }
  if (["completed", "cancelled"].includes(meeting.status)) {
    return { error: { ok: false, error: "invalid_state", uiHint: "error",
      summaryText: `Meeting is already ${meeting.status} — can't edit a closed meeting.` } };
  }
  return { meeting };
}

function pickChanges(args, meeting) {
  const changes = {};
  for (const field of UPDATABLE_FIELDS) {
    if (!(field in args)) continue;
    const next = args[field];
    if (next === "" || next == null) continue;
    if (field === "date") {
      const d = new Date(next);
      if (Number.isNaN(d.getTime())) return { invalid: `Invalid date: ${next}` };
      if (d.getTime() === new Date(meeting.date).getTime()) continue;
      changes.date = d;
      continue;
    }
    if (field === "assignedTo") {
      if (!mongoose.isValidObjectId(next)) return { invalid: `Invalid assignee user id: ${next}` };
      if (String(meeting.assignedTo || "") === String(next)) continue;
      changes.assignedTo = next;
      continue;
    }
    if (meeting[field] === next) continue;
    changes[field] = next;
  }
  return { changes };
}

module.exports = {
  name: "updateMeeting",
  permission: "crm.update",
  isWrite: true,
  description:
    "Edit/reschedule a meeting — date, type, notes, duration, or assignee. Does NOT change status (use completeMeeting for that). Refuses to edit completed/cancelled meetings. Use for 'reschedule meeting M to tomorrow 5pm', 'change meeting M to site visit', 'update meeting M duration to 90 min'.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      meetingId: {
        type: "string",
        description: "Meeting ObjectId (24 hex). Use getMeetings first to find one.",
        minLength: 24,
        maxLength: 24,
      },
      date: {
        type: "string",
        minLength: 8,
        maxLength: 64,
        description: "New datetime — any parseable form (e.g. '2026-06-05T10:00', 'tomorrow 3pm'). Setting this will mark the meeting as 'rescheduled' and the controller will email the client.",
      },
      type: { type: "string", enum: MEETING_TYPES },
      notes: { type: "string", maxLength: 1000 },
      durationMinutes: { type: "integer", minimum: 15, maximum: 480 },
      assignedTo: {
        type: "string",
        minLength: 24,
        maxLength: 24,
        description: "User ObjectId to (re)assign the meeting to.",
      },
    },
    required: ["meetingId"],
  },

  async dryRun(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;
    const picked = pickChanges(args, r.meeting);
    if (picked.invalid) {
      return { ok: false, error: "invalid_args", summaryText: picked.invalid, uiHint: "error" };
    }
    const changes = picked.changes;
    if (Object.keys(changes).length === 0) {
      return {
        ok: false,
        error: "no_changes",
        summaryText: "No changes — every provided field matches the current meeting.",
        uiHint: "error",
      };
    }

    const isReschedule = changes.date && changes.date.getTime() !== new Date(r.meeting.date).getTime();
    const summaryParts = Object.entries(changes).map(([k, v]) => {
      if (k === "date") return `date → ${v.toLocaleString()}`;
      return `${k}=${v}`;
    });
    return {
      ok: true,
      proposalDescription:
        `Update meeting (${r.meeting.type}, ${new Date(r.meeting.date).toLocaleString()}) — ${summaryParts.join(", ")}` +
        (isReschedule ? " · status will become 'rescheduled' and the client will be emailed." : ""),
      args,
      preview: {
        meetingId: String(r.meeting._id),
        before: {
          date: r.meeting.date,
          type: r.meeting.type,
          notes: r.meeting.notes,
          durationMinutes: r.meeting.durationMinutes,
          status: r.meeting.status,
        },
        changes,
        isReschedule,
      },
    };
  },

  async apply(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;
    const picked = pickChanges(args, r.meeting);
    if (picked.invalid) {
      return { ok: false, error: "invalid_args", summaryText: picked.invalid, uiHint: "error" };
    }
    const changes = picked.changes;
    if (Object.keys(changes).length === 0) {
      return {
        ok: false,
        error: "no_changes",
        summaryText: "No changes — every provided field matches the current meeting.",
        uiHint: "error",
      };
    }

    const isReschedule = changes.date && changes.date.getTime() !== new Date(r.meeting.date).getTime();
    const set = { ...changes };
    if (isReschedule) {
      set.rescheduledFrom = r.meeting.date;
      set.status = "rescheduled";
    }

    await Meeting.updateOne({ _id: r.meeting._id }, { $set: set });

    // Fire matching notification: reschedule vs cancellation vs generic edit
    if (isReschedule || changes.status === "cancelled") {
      const lead = await CRMClient.findById(r.meeting.leadId).select("name").lean();
      const recipients = [r.meeting.assignedTo, ...((r.meeting.attendees?.internal || []).map((a) => a.userId))].filter(Boolean);
      const leadName = lead?.name || "client";

      if (isReschedule) {
        const niceDate = changes.date.toLocaleString("en-IN", {
          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
        });
        notify({
          type: "meeting.rescheduled",
          module: "meeting",
          priority: "high",
          title: `Meeting with ${leadName} rescheduled`,
          message: `Moved to ${niceDate} (via AI assistant).`,
          link: `/crm/leads/${r.meeting.leadId}`,
          recipients,
          actor: { _id: ctx.userId, name: ctx.userName || "AI Assistant" },
          notifyActor: true,
          relatedTo: { module: "meeting", recordId: r.meeting._id },
          metadata: { leadName, oldDate: r.meeting.date, newDate: changes.date, viaAI: true },
        });
      } else if (changes.status === "cancelled") {
        notify({
          type: "meeting.cancelled",
          module: "meeting",
          priority: "normal",
          title: `Meeting with ${leadName} cancelled`,
          message: `The ${r.meeting.type} meeting was cancelled (via AI assistant).`,
          link: `/crm/leads/${r.meeting.leadId}`,
          recipients,
          actor: { _id: ctx.userId, name: ctx.userName || "AI Assistant" },
          notifyActor: true,
          relatedTo: { module: "meeting", recordId: r.meeting._id },
          metadata: { leadName, viaAI: true },
        });
      }
    }

    return {
      ok: true,
      summaryText: isReschedule
        ? `Meeting rescheduled to ${changes.date.toLocaleString()}.`
        : `Meeting updated — ${Object.keys(changes).join(", ")}.`,
      uiHint: "actionDone",
      data: {
        meetingId: String(r.meeting._id),
        leadId: String(r.meeting.leadId),
        changedFields: Object.keys(set),
        url: "/crm/meetings",
      },
    };
  },
};
