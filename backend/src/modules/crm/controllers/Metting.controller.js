const Meeting = require("../models/Metting.model");
const Lead = require("../models/CRMClient.model");
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
      .populate("leadId", "name phone city projectType siteAddress email trackingId")
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
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

module.exports = {
  createMeeting,
  getMeetingsByLead,
  updateMeeting,
  getAllMeetings,
  deleteMeeting,
  getTodayMeetings,
  getTotalMeetings,
};
