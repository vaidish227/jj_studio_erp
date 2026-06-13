// Write tool: cancel a scheduled/rescheduled meeting. Mirrors the
// lead-side effects of the existing controller (Metting.controller.js:316-323):
// lead.status → 'contacted', lifecycleStage → 'kit', plus interaction entry.
// Refuses if the meeting is already completed or cancelled.

const Meeting = require("../../crm/models/Metting.model");
const CRMClient = require("../../crm/models/CRMClient.model");
const { resolveMeeting } = require("../utils/resolveCrm");
const { dispatch: notify } = require("../../notifications/services/notificationDispatcher");

const WIDER_PERMS = ["*", "crm.update"];

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
      summaryText: "Only the assigned staff (or admin) can cancel this meeting." } };
  }
  if (meeting.status === "cancelled") {
    return { error: { ok: false, error: "no_op", uiHint: "error",
      summaryText: "Meeting is already cancelled." } };
  }
  if (meeting.status === "completed") {
    return { error: { ok: false, error: "invalid_state", uiHint: "error",
      summaryText: "Can't cancel a completed meeting." } };
  }
  return { meeting };
}

module.exports = {
  name: "cancelMeeting",
  permission: "crm.update",
  isWrite: true,
  description:
    "Cancel a scheduled or rescheduled meeting. Sets status='cancelled', notifies the assigned staff + internal attendees, and rewinds the parent lead's lifecycle to 'kit'. Refuses to cancel a meeting that's already completed or cancelled. Use for 'cancel meeting with X', 'meeting cancelled', 'call off Monday's site visit'. Pass an optional reason to record on the lead's interaction history.",
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
      reason: {
        type: "string",
        maxLength: 500,
        description: "Optional reason for cancellation (recorded on the lead's timeline).",
      },
    },
    required: ["meetingId"],
  },

  async dryRun(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;

    const lead = await CRMClient.findById(r.meeting.leadId).select("name trackingId").lean();
    const leadName = lead?.name || "(unknown lead)";

    return {
      ok: true,
      proposalDescription:
        `Cancel ${r.meeting.type} meeting with "${leadName}" (${new Date(r.meeting.date).toLocaleString()}) — ` +
        `status moves to 'cancelled', lead lifecycle rewinds to 'kit', and assigned staff/attendees are notified.` +
        (args.reason ? ` Reason: ${args.reason.slice(0, 120)}` : ""),
      args,
      preview: {
        meetingId: String(r.meeting._id),
        leadName,
        leadTrackingId: lead?.trackingId || null,
        meetingDate: r.meeting.date,
        meetingType: r.meeting.type,
        fromStatus: r.meeting.status,
        toStatus: "cancelled",
        reason: args.reason || null,
      },
    };
  },

  async apply(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;

    await Meeting.updateOne({ _id: r.meeting._id }, { $set: { status: "cancelled" } });

    // Mirror lead-lifecycle changes from Metting.controller.js (lines 316-323)
    const lead = await CRMClient.findById(r.meeting.leadId);
    if (lead) {
      lead.status = "contacted";
      lead.lifecycleStage = "kit";
      lead.interactionHistory = Array.isArray(lead.interactionHistory) ? lead.interactionHistory : [];
      lead.interactionHistory.push({
        createdAt: new Date(),
        type: "meeting",
        title: "Meeting cancelled",
        description: args.reason ? `Meeting was cancelled. Reason: ${args.reason}` : "Meeting was cancelled.",
        metadata: { meetingId: r.meeting._id, viaAI: true },
      });
      lead.lastInteractionAt = new Date();
      await lead.save();
    }

    // Notify the assigned staff + internal attendees
    const recipients = [
      r.meeting.assignedTo,
      ...((r.meeting.attendees?.internal || []).map((a) => a.userId)),
    ].filter(Boolean);
    const leadName = lead?.name || "client";
    const niceDate = new Date(r.meeting.date).toLocaleString("en-IN", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
    notify({
      type: "meeting.cancelled",
      module: "meeting",
      priority: "normal",
      title: `Meeting with ${leadName} cancelled`,
      message: `The ${r.meeting.type} meeting scheduled for ${niceDate} was cancelled (via AI assistant).`,
      link: `/crm/leads/${r.meeting.leadId}`,
      recipients,
      actor: { _id: ctx.userId, name: ctx.userName || "AI Assistant" },
      notifyActor: true,
      relatedTo: { module: "meeting", recordId: r.meeting._id },
      metadata: { leadName, viaAI: true, reason: args.reason || null },
    });

    return {
      ok: true,
      summaryText: `Meeting cancelled — lead lifecycle rewound to 'kit'.`,
      uiHint: "actionDone",
      data: {
        meetingId: String(r.meeting._id),
        leadId: String(r.meeting.leadId),
        leadName: lead?.name || null,
        newStatus: "cancelled",
        url: "/crm/meetings",
      },
    };
  },
};
