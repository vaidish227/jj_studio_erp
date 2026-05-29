// Write tool: record Minutes of Meeting on a completed meeting. Captures
// attendees, discussion summary, decisions, and action items. For each
// action item that carries a dueDate, this tool ALSO auto-creates a
// linked Followup — matching the behaviour of Metting.controller.recordMOM
// at lines 351-493. Re-recording (editing) cleans up the previously-
// generated pending followups before recreating them.

const mongoose = require("mongoose");
const Meeting = require("../../crm/models/Metting.model");
const Followup = require("../../crm/models/FollowUp.model");
const CRMClient = require("../../crm/models/CRMClient.model");
const { resolveMeeting, resolveLead } = require("../utils/resolveCrm");

const WIDER_PERMS = ["*", "crm.update"];

const IST_DATE_FMT = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
});
function fmtIstDay(d) {
  return d ? IST_DATE_FMT.format(new Date(d)) : "";
}

function isObjectId(s) {
  return mongoose.isValidObjectId(s) && String(s).length === 24;
}

// Resolve the target meeting from EITHER an explicit meetingId OR a lead
// name/trackingId. Resolving by lead name is the safe path — it avoids the
// model hand-picking the wrong ObjectId out of a long getMeetings list (which
// once recorded a MOM on the wrong person). Lead-name resolution is exact:
// resolveLead refuses ambiguous matches, and we then scope to that lead's
// COMPLETED meetings, asking the user to disambiguate if there's more than one.
async function resolveTargetMeeting(args) {
  if (args.meetingId) {
    const r = await resolveMeeting(args.meetingId);
    if (r.error) return { error: { ok: false, error: "not_found", summaryText: r.error, uiHint: "error" } };
    return { meeting: r.doc };
  }
  if (args.leadId) {
    const lr = await resolveLead(args.leadId);
    if (lr.error) {
      return { error: { ok: false, error: lr.candidates ? "ambiguous" : "not_found", summaryText: lr.error, uiHint: "error" } };
    }
    const lead = lr.doc;
    const meetings = await Meeting.find({ leadId: lead._id, status: "completed" })
      .sort({ date: -1 })
      .limit(10)
      .lean();
    if (meetings.length === 0) {
      return { error: { ok: false, error: "not_found", uiHint: "error",
        summaryText: `No completed meeting found for "${lead.name}". A MOM can only be recorded on a completed meeting.` } };
    }
    if (meetings.length > 1) {
      const list = meetings.map((m) => `${m.type} on ${fmtIstDay(m.date)} (id ${m._id})`).join("; ");
      return { error: { ok: false, error: "ambiguous", uiHint: "error",
        summaryText: `"${lead.name}" has ${meetings.length} completed meetings: ${list}. Which one? Pass that meetingId.` } };
    }
    return { meeting: meetings[0] };
  }
  return { error: { ok: false, error: "invalid_args", uiHint: "error",
    summaryText: "Provide a meetingId or a leadId (lead name) to record the MOM." } };
}

async function loadAndAuthorize(args, ctx) {
  const r = await resolveTargetMeeting(args);
  if (r.error) return r;
  const meeting = r.meeting;
  const isOwner = String(meeting.assignedTo || "") === String(ctx.userId)
                || String(meeting.createdBy || "") === String(ctx.userId);
  const elevated = (ctx.permissions || []).some((p) => WIDER_PERMS.includes(p));
  if (!isOwner && !elevated) {
    return { error: { ok: false, error: "denied", uiHint: "error",
      summaryText: "Only the assigned staff (or admin) can record MOM for this meeting." } };
  }
  if (meeting.status !== "completed") {
    return { error: { ok: false, error: "invalid_state", uiHint: "error",
      summaryText: "MOM can only be recorded for completed meetings. Mark the meeting as completed first." } };
  }
  return { meeting };
}

// Validate + normalize incoming MOM payload. Returns either { mom, autoFollowups } or { invalid }.
function buildMom(args) {
  const staff = Array.isArray(args.attendees?.staff) ? args.attendees.staff : [];
  for (const sid of staff) {
    if (!isObjectId(sid)) return { invalid: `Invalid staff user id: ${sid}` };
  }
  const clients = Array.isArray(args.attendees?.clients)
    ? args.attendees.clients.map((s) => String(s).trim()).filter(Boolean)
    : [];

  const decisions = Array.isArray(args.decisions)
    ? args.decisions.map((d) => String(d).trim()).filter(Boolean)
    : [];

  const actionItems = [];
  const items = Array.isArray(args.actionItems) ? args.actionItems : [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i] || {};
    const description = String(it.description || "").trim();
    if (!description) continue;
    if (it.assignedTo && !isObjectId(it.assignedTo)) {
      return { invalid: `Action item #${i + 1} has an invalid assignee` };
    }
    let dueDate = null;
    if (it.dueDate) {
      const d = new Date(it.dueDate);
      if (Number.isNaN(d.getTime())) return { invalid: `Action item #${i + 1} has an invalid dueDate` };
      dueDate = d;
    }
    actionItems.push({
      description,
      assignedTo: it.assignedTo || null,
      dueDate,
    });
  }

  return {
    mom: {
      attendees: { staff, clients },
      discussionSummary: String(args.discussionSummary || "").trim(),
      decisions,
      actionItems,
    },
  };
}

module.exports = {
  name: "recordMOM",
  permission: "crm.update",
  isWrite: true,
  description:
    "Record Minutes of Meeting on a completed meeting — attendees, discussion summary, decisions, and action items. Action items with a dueDate auto-create a linked Followup so nothing falls through the cracks. Re-recording on the same meeting replaces previous MOM and cleans up the old pending followups. " +
    "This is the natural follow-up to completeMeeting — after a meeting is marked complete, proactively offer to record the MOM. " +
    "PREFER passing leadId (the lead's name) over meetingId — let the tool find that lead's completed meeting, instead of hand-picking a meeting ObjectId (picking the wrong id from a list has recorded MOMs on the wrong person). " +
    "Use for 'record MOM for Rajiv: discussed colours, decided on palette A, action item: send 3D render by Friday'.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      leadId: {
        type: "string",
        description: "PREFERRED. The lead's name fragment (e.g. 'Rajiv'), trackingId (CLI-YYYY-NNNN), or ObjectId. The tool finds that lead's COMPLETED meeting. If the name is ambiguous or the lead has multiple completed meetings, the tool returns the candidates so you can ask which — then pass that meetingId. Provide either leadId or meetingId.",
        minLength: 2,
        maxLength: 100,
      },
      meetingId: {
        type: "string",
        description: "Meeting ObjectId (24 hex). Meeting must be in 'completed' status. Use this only when you already have the exact id (e.g. after disambiguating). Otherwise prefer leadId.",
        minLength: 24,
        maxLength: 24,
      },
      attendees: {
        type: "object",
        additionalProperties: false,
        properties: {
          staff: {
            type: "array",
            description: "User ObjectIds of internal attendees.",
            items: { type: "string", minLength: 24, maxLength: 24 },
            maxItems: 20,
          },
          clients: {
            type: "array",
            description: "Free-text names of client-side attendees.",
            items: { type: "string", maxLength: 120 },
            maxItems: 20,
          },
        },
      },
      discussionSummary: {
        type: "string",
        maxLength: 4000,
        description: "Narrative summary of what was discussed.",
      },
      decisions: {
        type: "array",
        description: "List of concrete decisions taken.",
        items: { type: "string", maxLength: 500 },
        maxItems: 30,
      },
      actionItems: {
        type: "array",
        description: "List of action items. Items with a dueDate auto-create a linked Followup.",
        maxItems: 30,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            description: { type: "string", minLength: 2, maxLength: 500 },
            assignedTo: { type: "string", minLength: 24, maxLength: 24 },
            dueDate: { type: "string", minLength: 8, maxLength: 64 },
          },
          required: ["description"],
        },
      },
    },
    required: [],
  },

  async dryRun(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;

    const built = buildMom(args);
    if (built.invalid) {
      return { ok: false, error: "invalid_args", summaryText: built.invalid, uiHint: "error" };
    }
    const mom = built.mom;
    if (!mom.discussionSummary && mom.decisions.length === 0 && mom.actionItems.length === 0) {
      return {
        ok: false,
        error: "empty_mom",
        summaryText: "MOM is empty — provide at least a discussion summary, a decision, or an action item.",
        uiHint: "error",
      };
    }

    const lead = await CRMClient.findById(r.meeting.leadId).select("name trackingId").lean();
    const autoFollowups = mom.actionItems.filter((ai) => ai.dueDate).length;
    const isUpdate = !!r.meeting.mom?.recordedAt;

    return {
      ok: true,
      proposalDescription:
        `${isUpdate ? "Update" : "Record"} MOM for ${r.meeting.type} meeting with "${lead?.name || "(lead)"}"` +
        (r.meeting.date ? ` on ${fmtIstDay(r.meeting.date)}` : "") +
        ` — ${mom.decisions.length} decision(s), ${mom.actionItems.length} action item(s)` +
        (autoFollowups > 0 ? ` (${autoFollowups} will auto-create follow-ups)` : "") +
        (isUpdate ? ". Previous pending follow-ups from this MOM will be replaced." : "."),
      // Lock the RESOLVED meeting id into the confirmed args so apply() acts on
      // exactly the meeting shown on the card — never re-resolves the name.
      args: { ...args, meetingId: String(r.meeting._id) },
      preview: {
        meetingId: String(r.meeting._id),
        leadName: lead?.name || null,
        leadTrackingId: lead?.trackingId || null,
        isUpdate,
        attendees: mom.attendees,
        discussionSummary: mom.discussionSummary || null,
        decisions: mom.decisions,
        actionItems: mom.actionItems,
        autoFollowupsToCreate: autoFollowups,
      },
    };
  },

  async apply(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;
    const built = buildMom(args);
    if (built.invalid) {
      return { ok: false, error: "invalid_args", summaryText: built.invalid, uiHint: "error" };
    }
    const mom = built.mom;
    if (!mom.discussionSummary && mom.decisions.length === 0 && mom.actionItems.length === 0) {
      return {
        ok: false,
        error: "empty_mom",
        summaryText: "MOM is empty — provide at least a discussion summary, a decision, or an action item.",
        uiHint: "error",
      };
    }

    // Re-recording: clean up old pending followups that were auto-generated.
    const isFirst = !r.meeting.mom?.recordedAt;
    if (!isFirst && Array.isArray(r.meeting.mom?.actionItems)) {
      const oldFuIds = r.meeting.mom.actionItems.map((ai) => ai.followUpId).filter(Boolean);
      if (oldFuIds.length) {
        await Followup.deleteMany({ _id: { $in: oldFuIds }, status: "pending" });
      }
    }

    // Auto-create Followups for action items with a dueDate.
    const itemsWithFu = [];
    for (const ai of mom.actionItems) {
      const out = { ...ai, status: "open" };
      if (ai.dueDate) {
        try {
          const fu = await Followup.create({
            leadId: r.meeting.leadId,
            date: ai.dueDate,
            note: `[MOM Action Item] ${ai.description}`,
            assignedTo: ai.assignedTo || undefined,
            status: "pending",
          });
          out.followUpId = fu._id;
        } catch (e) {
          // Don't fail the whole apply — preserve the action item without the link.
          console.error("recordMOM tool: failed to create followup:", e.message);
        }
      }
      itemsWithFu.push(out);
    }

    const newMom = {
      attendees: mom.attendees,
      discussionSummary: mom.discussionSummary,
      decisions: mom.decisions,
      actionItems: itemsWithFu,
      recordedBy: ctx.userId,
      recordedAt: new Date(),
    };

    const set = { mom: newMom };
    // Mirror summary into outcome if outcome is still empty (matches controller).
    if (!r.meeting.outcome && newMom.discussionSummary) {
      set.outcome = newMom.discussionSummary.slice(0, 500);
    }
    await Meeting.updateOne({ _id: r.meeting._id }, { $set: set });

    // Append timeline entry on the parent lead.
    await CRMClient.updateOne(
      { _id: r.meeting.leadId },
      {
        $push: {
          interactionHistory: {
            type: "meeting",
            title: isFirst ? "MOM recorded" : "MOM updated",
            description: (newMom.discussionSummary || "Meeting minutes captured.").slice(0, 280),
            metadata: {
              meetingId: r.meeting._id,
              decisionsCount: newMom.decisions.length,
              actionItemsCount: newMom.actionItems.length,
            },
            createdAt: new Date(),
          },
        },
        $currentDate: { lastInteractionAt: true },
      }
    );

    const autoCount = itemsWithFu.filter((ai) => ai.followUpId).length;
    return {
      ok: true,
      summaryText:
        `${isFirst ? "Recorded" : "Updated"} MOM — ${newMom.decisions.length} decisions, ${newMom.actionItems.length} action items` +
        (autoCount ? `, ${autoCount} follow-up${autoCount === 1 ? "" : "s"} created.` : "."),
      uiHint: "actionDone",
      data: {
        meetingId: String(r.meeting._id),
        leadId: String(r.meeting.leadId),
        isUpdate: !isFirst,
        decisionsCount: newMom.decisions.length,
        actionItemsCount: newMom.actionItems.length,
        autoFollowupsCreated: autoCount,
        url: "/crm/meetings",
      },
    };
  },
};
