// Write tool: mark a meeting as completed and capture outcome + the
// clientInterested signal. The controller cascades these into the parent
// lead's lifecycleStage (interested / followup_due) and timeline, so this
// tool is the gateway for that workflow. Refuses if already completed.

const mongoose = require("mongoose");
const Meeting = require("../../crm/models/Metting.model");
const CRMClient = require("../../crm/models/CRMClient.model");
const { resolveMeeting } = require("../utils/resolveCrm");

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
      summaryText: "Only the assigned staff (or admin) can complete this meeting." } };
  }
  if (meeting.status === "completed") {
    return { error: { ok: false, error: "no_op", uiHint: "error",
      summaryText: "Meeting is already completed." } };
  }
  if (meeting.status === "cancelled") {
    return { error: { ok: false, error: "invalid_state", uiHint: "error",
      summaryText: "Can't complete a cancelled meeting." } };
  }

  let followUpDate = null;
  if (args.followUpDate) {
    const d = new Date(args.followUpDate);
    if (Number.isNaN(d.getTime())) {
      return { error: { ok: false, error: "invalid_args", uiHint: "error",
        summaryText: `Invalid followUpDate: ${args.followUpDate}` } };
    }
    followUpDate = d;
  }
  return { meeting, followUpDate };
}

module.exports = {
  name: "completeMeeting",
  permission: "crm.update",
  isWrite: true,
  description:
    "Mark a meeting as completed and capture what happened. Setting clientInterested=true moves the lead to 'interested' (ready for proposal). Setting clientInterested=false (or omitting it) routes the lead to 'followup_due'. " +
    "IMPORTANT conversational flow: before calling this tool, ASK the user for (a) the meeting outcome and (b) whether the client was interested — unless they already volunteered both. After the user confirms the completion, offer to record the MOM via recordMOM. " +
    "Use for 'mark meeting done — client is interested', 'meeting complete, no interest yet, schedule follow-up'.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      meetingId: {
        type: "string",
        description: "Meeting ObjectId (24 hex).",
        minLength: 24,
        maxLength: 24,
      },
      outcome: {
        type: "string",
        maxLength: 1000,
        description: "Short summary of how the meeting went.",
      },
      clientInterested: {
        type: "boolean",
        description: "true if the client showed clear interest (drives lifecycle → 'interested'). false if not. Omit if uncertain.",
      },
      followUpDate: {
        type: "string",
        minLength: 8,
        maxLength: 64,
        description: "Optional date to capture if a follow-up is required (any parseable form).",
      },
    },
    required: ["meetingId"],
  },

  async dryRun(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;

    const lead = await CRMClient.findById(r.meeting.leadId).select("name trackingId status lifecycleStage").lean();
    const leadName = lead?.name || "(unknown lead)";

    const interestLabel =
      args.clientInterested === true ? "interested → lifecycle moves to 'interested' (ready for proposal)"
      : args.clientInterested === false ? "not yet interested → lifecycle moves to 'followup_due'"
      : "interest not captured → lifecycle moves to 'followup_due'";

    return {
      ok: true,
      proposalDescription:
        `Mark ${r.meeting.type} meeting with "${leadName}" (${new Date(r.meeting.date).toLocaleString()}) as completed — ${interestLabel}` +
        (args.outcome ? ` · outcome: ${args.outcome.slice(0, 120)}` : "") +
        (r.followUpDate ? ` · follow-up: ${r.followUpDate.toLocaleDateString()}` : ""),
      args,
      preview: {
        meetingId: String(r.meeting._id),
        leadName,
        leadTrackingId: lead?.trackingId || null,
        meetingDate: r.meeting.date,
        meetingType: r.meeting.type,
        fromStatus: r.meeting.status,
        toStatus: "completed",
        outcome: args.outcome || null,
        clientInterested: args.clientInterested ?? null,
        followUpDate: r.followUpDate,
      },
    };
  },

  async apply(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;

    // Apply meeting fields. Cannot use updateOne+$set here because the lead
    // lifecycle side-effect lives in the existing controller flow — we
    // duplicate that logic atomically to keep behaviour aligned with
    // updateMeeting in Metting.controller.js (lines 142-242).
    const set = { status: "completed" };
    if (args.outcome != null) set.outcome = args.outcome;
    if (args.clientInterested != null) set.clientInterested = args.clientInterested;
    if (r.followUpDate) set.followUpDate = r.followUpDate;
    await Meeting.updateOne({ _id: r.meeting._id }, { $set: set });

    // Mirror lead-lifecycle changes from Metting.controller.js
    const lead = await CRMClient.findById(r.meeting.leadId);
    if (lead) {
      lead.status = "meeting_done";
      let title = "Meeting completed";
      let description = "Meeting outcome recorded.";

      if (args.clientInterested === true) {
        lead.lifecycleStage = "interested";
        title = "Client marked as interested";
        description = "Meeting completed. Client expressed interest — ready for proposal creation.";
      } else if (args.clientInterested === false) {
        lead.lifecycleStage = "followup_due";
        title = "Meeting completed — follow-up required";
        description = "Meeting completed. Client not yet interested. Follow-up scheduled.";
      } else {
        lead.lifecycleStage = "followup_due";
      }

      lead.interactionHistory = Array.isArray(lead.interactionHistory) ? lead.interactionHistory : [];
      lead.interactionHistory.push({
        createdAt: new Date(),
        type: args.clientInterested === true ? "status_change" : "meeting",
        title,
        description,
        metadata: { meetingId: r.meeting._id, outcome: args.outcome || null },
      });
      lead.lastInteractionAt = new Date();
      await lead.save();
    }

    return {
      ok: true,
      summaryText:
        `Meeting marked completed${args.clientInterested === true ? " — lead moved to 'interested'." :
         args.clientInterested === false ? " — lead moved to 'followup_due'." : "."}`,
      uiHint: "actionDone",
      data: {
        meetingId: String(r.meeting._id),
        leadId: String(r.meeting.leadId),
        leadName: lead?.name || null,
        newStatus: "completed",
        clientInterested: args.clientInterested ?? null,
        lifecycleStage: lead?.lifecycleStage || null,
        url: "/crm/meetings",
      },
    };
  },
};
