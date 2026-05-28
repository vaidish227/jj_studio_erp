const Meeting = require("../models/Metting.model");
const Lead = require("../models/CRMClient.model");
const Followup = require("../models/FollowUp.model");
const mongoose = require("mongoose");
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const sendEmail = require("../utils/sendEmail");
const getMeetingTemplate = require("../utils/Template/meetingTemplate");
const getMeetingRescheduleTemplate = require("../utils/Template/meetingRescheduleTemplate");

// ─── Helper: append interaction to CRMClient timeline ─────────────────
const appendInteraction = (client, entry) => {
  client.interactionHistory = Array.isArray(client.interactionHistory)
    ? client.interactionHistory
    : [];
  client.interactionHistory.push({ createdAt: new Date(), ...entry });
  client.lastInteractionAt = new Date();
};

// ─── Helper: normalize + validate attendees payload from req.body ─────
// Returns { ok: true, value } or { ok: false, message }.
// Drops malformed rows silently; rejects only on hard schema violations.
const normalizeAttendees = (raw) => {
  if (raw === undefined) return { ok: true, value: undefined };
  if (raw === null) return { ok: true, value: { internal: [], client: [] } };
  if (typeof raw !== "object") {
    return { ok: false, message: "attendees must be an object" };
  }

  const internalIn = Array.isArray(raw.internal) ? raw.internal : [];
  const clientIn = Array.isArray(raw.client) ? raw.client : [];

  const internal = [];
  for (const a of internalIn) {
    if (!a || typeof a !== "object") continue;
    if (!a.userId || !isValidId(a.userId)) {
      return { ok: false, message: "Each internal attendee requires a valid userId" };
    }
    internal.push({
      userId: a.userId,
      name: a.name || "",
      email: a.email || "",
      phone: a.phone || "",
      role: a.role || "",
      notifyEmail: a.notifyEmail !== false,
      notifyWhatsApp: a.notifyWhatsApp !== false,
    });
  }

  const client = [];
  for (const a of clientIn) {
    if (!a || typeof a !== "object") continue;
    const name = (a.name || "").trim();
    if (!name) continue;
    client.push({
      name,
      email: a.email || "",
      phone: a.phone || "",
      relation: a.relation || "other",
      notifyEmail: a.notifyEmail !== false,
      notifyWhatsApp: a.notifyWhatsApp !== false,
    });
  }

  return { ok: true, value: { internal, client } };
};

// =====================================================================
//  CREATE MEETING
// =====================================================================
const createMeeting = async (req, res) => {
  try {
    const { leadId, date, type, status = "scheduled", assignedTo, notes, durationMinutes } = req.body;

    if (!leadId || !date || !type) {
      return res.status(400).json({ message: "leadId, date and type are required" });
    }

    if (!isValidId(leadId)) {
      return res.status(400).json({ message: "Invalid leadId" });
    }

    if (assignedTo && !isValidId(assignedTo)) {
      return res.status(400).json({ message: "Invalid assignedTo user ID" });
    }

    const attendeesResult = normalizeAttendees(req.body.attendees);
    if (!attendeesResult.ok) {
      return res.status(400).json({ message: attendeesResult.message });
    }

    const meetingDateObj = new Date(date);
    const now = new Date();
    now.setSeconds(0, 0);

    if (meetingDateObj < now) {
      return res.status(400).json({ message: "Cannot schedule a meeting in the past" });
    }

    const existingMeeting = await Meeting.findOne({ date: meetingDateObj, status: "scheduled" });
    if (existingMeeting) {
      return res.status(400).json({
        message: "A meeting is already scheduled for this time slot. Please choose another time.",
      });
    }

    const lead = await Lead.findById(leadId);
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    const normalizedType =
      type === "Office Meeting" ? "office" : String(type).toLowerCase();

    const meeting = await Meeting.create({
      leadId,
      type: normalizedType,
      date: meetingDateObj,
      status,
      notes,
      durationMinutes: durationMinutes || 60,
      assignedTo: assignedTo || null,
      attendees: attendeesResult.value || { internal: [], client: [] },
      createdBy: req.user?._id || null,
    });

    lead.meetingDate = meetingDateObj;
    lead.status = status === "completed" ? "meeting_done" : "contacted";
    lead.lifecycleStage = "meeting_scheduled";
    lead.automation = {
      ...lead.automation,
      thankYouScheduledFor: new Date(meetingDateObj.getTime() + 2 * 60 * 60 * 1000),
      followupReminderFor: new Date(meetingDateObj.getTime() + 2 * 24 * 60 * 60 * 1000),
    };

    appendInteraction(lead, {
      type: "meeting",
      title: "Meeting scheduled",
      description: `A ${normalizedType} meeting was scheduled for ${meetingDateObj.toLocaleString("en-IN")}.`,
    });

    await lead.save();

    // Send confirmation email
    // TODO(meeting-notifications): replace this single-recipient send with
    // mailService.enqueue + whatsappService.enqueue, looping
    // meeting.attendees.internal + meeting.attendees.client and honouring each
    // attendee's notifyEmail / notifyWhatsApp toggles. Use
    // relatedTo: { module: "meeting", recordId: meeting._id }.
    if (lead.email) {
      try {
        const d = meetingDateObj;
        const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
        const timeStr = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
        await sendEmail({
          to: lead.email,
          subject: "Meeting Confirmation - JJ Studio",
          html: getMeetingTemplate(lead.name, normalizedType, dateStr, timeStr, notes),
        });
      } catch (emailErr) {
        console.error("Failed to send meeting confirmation email:", emailErr.message);
      }
    }

    const populated = await Meeting.findById(meeting._id)
      .populate("assignedTo", "name email")
      .populate("attendees.internal.userId", "name email phone role")
      .populate("createdBy", "name email");

    res.status(201).json({ message: "Meeting created successfully", meeting: populated, lead });
  } catch (err) {
    console.error("createMeeting error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

// =====================================================================
//  GET MEETINGS BY LEAD
// =====================================================================
const getMeetingsByLead = async (req, res) => {
  try {
    const { leadId } = req.params;

    if (!leadId || !isValidId(leadId)) {
      return res.status(400).json({ message: "Valid Lead ID is required" });
    }

    const meetings = await Meeting.find({ leadId })
      .populate("assignedTo", "name email")
      .populate("attendees.internal.userId", "name email phone role")
      .populate("createdBy", "name email")
      .sort({ date: -1 });

    res.status(200).json({ message: "Meetings fetched successfully", meetings });
  } catch (err) {
    console.error("getMeetingsByLead error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

// =====================================================================
//  UPDATE MEETING
//  Key logic: when status → "completed" and clientInterested is set,
//  drives the CRM "interested" lifecycle transition.
// =====================================================================
const updateMeeting = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !isValidId(id)) {
      return res.status(400).json({ message: "Valid Meeting ID is required" });
    }

    const meeting = await Meeting.findById(id);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });

    const oldDate = meeting.date;
    const oldStatus = meeting.status;
    const newDate = req.body.date ? new Date(req.body.date) : null;
    const isRescheduled = newDate && newDate.getTime() !== new Date(oldDate).getTime();

    // Track original date before overwriting
    if (isRescheduled) {
      req.body.rescheduledFrom = oldDate;
      if (!req.body.status) req.body.status = "rescheduled";
    }

    // Allowed fields — only update what's provided
    const allowedFields = [
      "date", "type", "notes", "status", "durationMinutes",
      "assignedTo", "outcome", "clientInterested", "followUpDate", "rescheduledFrom",
    ];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) meeting[field] = req.body[field];
    });

    if (req.body.attendees !== undefined) {
      const attendeesResult = normalizeAttendees(req.body.attendees);
      if (!attendeesResult.ok) {
        return res.status(400).json({ message: attendeesResult.message });
      }
      meeting.attendees = attendeesResult.value;
    }

    await meeting.save();

    const lead = await Lead.findById(meeting.leadId);

    if (lead && req.body.status) {
      const newStatus = req.body.status;
      const clientInterested = req.body.clientInterested;

      if (newStatus === "completed") {
        lead.status = "meeting_done";

        if (clientInterested === true) {
          // Key workflow trigger: client showed interest → move to Interested stage
          lead.lifecycleStage = "interested";
          appendInteraction(lead, {
            type: "status_change",
            title: "Client marked as interested",
            description: "Meeting completed. Client expressed interest — ready for proposal creation.",
            metadata: { meetingId: meeting._id, outcome: req.body.outcome },
          });
        } else if (clientInterested === false) {
          lead.lifecycleStage = "followup_due";
          appendInteraction(lead, {
            type: "meeting",
            title: "Meeting completed — follow-up required",
            description: `Meeting completed. Client not yet interested. Follow-up scheduled.`,
            metadata: { meetingId: meeting._id, outcome: req.body.outcome },
          });
        } else {
          // outcome captured but clientInterested not set
          lead.lifecycleStage = "followup_due";
          appendInteraction(lead, {
            type: "meeting",
            title: "Meeting completed",
            description: `Meeting outcome recorded.`,
            metadata: { meetingId: meeting._id },
          });
        }
      } else if (newStatus === "rescheduled") {
        lead.lifecycleStage = "meeting_scheduled";
        appendInteraction(lead, {
          type: "meeting",
          title: "Meeting rescheduled",
          description: `Meeting rescheduled to ${new Date(req.body.date).toLocaleString("en-IN")}.`,
        });
      } else if (newStatus === "cancelled") {
        lead.status = "contacted";
        lead.lifecycleStage = "kit";
        appendInteraction(lead, {
          type: "meeting",
          title: "Meeting cancelled",
          description: "Meeting was cancelled.",
        });
      } else if (newStatus === "follow_up_required") {
        lead.lifecycleStage = "followup_due";
        appendInteraction(lead, {
          type: "meeting",
          title: "Follow-up required",
          description: `Follow-up needed after meeting. Next date: ${req.body.followUpDate ? new Date(req.body.followUpDate).toLocaleDateString("en-IN") : "TBD"}.`,
        });
      } else {
        appendInteraction(lead, {
          type: "meeting",
          title: "Meeting updated",
          description: `Meeting status changed to ${newStatus}.`,
        });
      }

      await lead.save();
    }

    // Send reschedule email
    if (lead?.email && isRescheduled) {
      try {
        const oldD = new Date(oldDate);
        const oldDateStr = `${String(oldD.getDate()).padStart(2, "0")}/${String(oldD.getMonth() + 1).padStart(2, "0")}/${String(oldD.getFullYear()).slice(-2)} ${oldD.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
        const newD = newDate;
        const newDateStr = `${String(newD.getDate()).padStart(2, "0")}/${String(newD.getMonth() + 1).padStart(2, "0")}/${String(newD.getFullYear()).slice(-2)}`;
        const newTimeStr = newD.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
        await sendEmail({
          to: lead.email,
          subject: "Meeting Rescheduled - JJ Studio",
          html: getMeetingRescheduleTemplate(lead.name, meeting.type, oldDateStr, newDateStr, newTimeStr, meeting.notes),
        });
      } catch (emailErr) {
        console.error("Failed to send reschedule email:", emailErr.message);
      }
    }

    const populated = await Meeting.findById(meeting._id)
      .populate("assignedTo", "name email")
      .populate("attendees.internal.userId", "name email phone role")
      .populate("createdBy", "name email");

    res.status(200).json({ message: "Meeting updated successfully", meeting: populated });
  } catch (err) {
    console.error("updateMeeting error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

// =====================================================================
//  GET ALL MEETINGS
// =====================================================================
const getAllMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find()
      .populate("leadId", "name phone city projectType siteAddress email trackingId spouse")
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .populate("attendees.internal.userId", "name email phone role")
      .populate("mom.attendees.staff", "name email role")
      .populate("mom.actionItems.assignedTo", "name email role")
      .populate("mom.recordedBy", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({ message: "Meetings fetched successfully", meetings });
  } catch (err) {
    console.error("getAllMeetings error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

// =====================================================================
//  DELETE MEETING
// =====================================================================
const deleteMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "Meeting ID is required" });

    const meeting = await Meeting.findById(id);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });

    await Meeting.findByIdAndDelete(id);
    res.status(200).json({ message: "Meeting deleted successfully" });
  } catch (err) {
    console.error("deleteMeeting error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

// =====================================================================
//  GET TODAY'S MEETINGS (dashboard stat)
// =====================================================================
const getTodayMeetings = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const todayMeetings = await Meeting.countDocuments({
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    res.status(200).json({ todayMeetings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// =====================================================================
//  GET TOTAL MEETINGS (dashboard stat)
// =====================================================================
const getTotalMeetings = async (req, res) => {
  try {
    const totalMeetings = await Meeting.countDocuments();
    res.status(200).json({ totalMeetings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// =====================================================================
//  RECORD / UPDATE MOM (Minutes of Meeting)
//  Captures attendees, discussion summary, decisions, and action items
//  for a completed meeting. Each action item with a due date auto-creates
//  a Followup entry so it lands in the user's task queue.
// =====================================================================
const recordMOM = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !isValidId(id)) {
      return res.status(400).json({ message: "Valid Meeting ID is required" });
    }

    const meeting = await Meeting.findById(id);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });

    if (meeting.status !== "completed") {
      return res.status(400).json({
        message: "MOM can only be recorded for completed meetings",
      });
    }

    const {
      attendees = {},
      discussionSummary = "",
      decisions = [],
      actionItems = [],
    } = req.body;

    // ── Validate attendees ──
    const staffIds = Array.isArray(attendees.staff) ? attendees.staff : [];
    for (const sid of staffIds) {
      if (!isValidId(sid)) {
        return res.status(400).json({ message: `Invalid staff user ID: ${sid}` });
      }
    }
    const clientAttendees = Array.isArray(attendees.clients)
      ? attendees.clients.map((s) => String(s).trim()).filter(Boolean)
      : [];

    // ── Validate decisions ──
    const cleanDecisions = Array.isArray(decisions)
      ? decisions.map((d) => String(d).trim()).filter(Boolean)
      : [];

    // ── Validate action items ──
    const cleanActionItems = [];
    for (const [idx, item] of (Array.isArray(actionItems) ? actionItems : []).entries()) {
      const description = String(item?.description || "").trim();
      if (!description) continue; // drop empty rows silently

      if (item.assignedTo && !isValidId(item.assignedTo)) {
        return res
          .status(400)
          .json({ message: `Action item #${idx + 1} has an invalid assignee` });
      }

      cleanActionItems.push({
        description,
        assignedTo: item.assignedTo || undefined,
        dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
        status: "open",
      });
    }

    const isFirstRecord = !meeting.mom?.recordedAt;

    // ── Auto-create Followups for action items that have a due date ──
    // Re-creating: if MOM is being updated, clean up old auto-created followups first
    if (!isFirstRecord && Array.isArray(meeting.mom?.actionItems)) {
      const oldFollowupIds = meeting.mom.actionItems
        .map((ai) => ai.followUpId)
        .filter(Boolean);
      if (oldFollowupIds.length) {
        // Only delete pending ones — preserve any that were already completed
        await Followup.deleteMany({
          _id: { $in: oldFollowupIds },
          status: "pending",
        });
      }
    }

    for (const ai of cleanActionItems) {
      if (!ai.dueDate) continue; // skip follow-up creation if no due date
      try {
        const fu = await Followup.create({
          leadId: meeting.leadId,
          date: ai.dueDate,
          note: `[MOM Action Item] ${ai.description}`,
          assignedTo: ai.assignedTo || undefined,
          status: "pending",
        });
        ai.followUpId = fu._id;
      } catch (fuErr) {
        console.error("Failed to create followup for action item:", fuErr.message);
      }
    }

    meeting.mom = {
      attendees: { staff: staffIds, clients: clientAttendees },
      discussionSummary: String(discussionSummary || "").trim(),
      decisions: cleanDecisions,
      actionItems: cleanActionItems,
      recordedBy: req.user?._id || meeting.mom?.recordedBy || undefined,
      recordedAt: new Date(),
    };

    // Also mirror summary into the existing `outcome` field for backward compat
    if (!meeting.outcome && meeting.mom.discussionSummary) {
      meeting.outcome = meeting.mom.discussionSummary.slice(0, 500);
    }

    await meeting.save();

    // ── Append timeline event on the parent client ──
    const lead = await Lead.findById(meeting.leadId);
    if (lead) {
      appendInteraction(lead, {
        type: "meeting",
        title: isFirstRecord ? "MOM recorded" : "MOM updated",
        description:
          (meeting.mom.discussionSummary || "Meeting minutes captured.").slice(0, 280),
        metadata: {
          meetingId: meeting._id,
          decisionsCount: cleanDecisions.length,
          actionItemsCount: cleanActionItems.length,
        },
      });
      await lead.save();
    }

    const populated = await Meeting.findById(meeting._id)
      .populate("leadId", "name phone city projectType email trackingId")
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .populate("mom.attendees.staff", "name email role")
      .populate("mom.actionItems.assignedTo", "name email role")
      .populate("mom.recordedBy", "name email");

    res.status(200).json({
      message: isFirstRecord ? "MOM recorded successfully" : "MOM updated successfully",
      meeting: populated,
    });
  } catch (err) {
    console.error("recordMOM error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

// =====================================================================
//  GET MOM for a meeting
// =====================================================================
const getMOM = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !isValidId(id)) {
      return res.status(400).json({ message: "Valid Meeting ID is required" });
    }
    const meeting = await Meeting.findById(id)
      .populate("leadId", "name phone city projectType email trackingId")
      .populate("mom.attendees.staff", "name email role")
      .populate("mom.actionItems.assignedTo", "name email role")
      .populate("mom.recordedBy", "name email");

    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    res.status(200).json({ meeting, mom: meeting.mom || null });
  } catch (err) {
    console.error("getMOM error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createMeeting,
  getMeetingsByLead,
  updateMeeting,
  getAllMeetings,
  deleteMeeting,
  getTodayMeetings,
  getTotalMeetings,
  recordMOM,
  getMOM,
};
