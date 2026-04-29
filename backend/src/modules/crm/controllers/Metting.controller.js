const Meeting = require("../models/Metting.model");
const Lead = require("../models/Lead.model");
const sendEmail = require("../utils/sendEmail");
const getMeetingTemplate = require("../utils/Template/meetingTemplate");
const getMeetingRescheduleTemplate = require("../utils/Template/meetingRescheduleTemplate");


const createMeeting = async (req, res) => {
  try {
    const { leadId, date, type, status = "scheduled" } = req.body;

    if (!leadId || !date || !type) {
      console.log("Required fields missing");
      return res.status(400).json({
        message: "leadId, date and type are required",
      });
    }

    const meetingDateObj = new Date(date);
    const now = new Date();
    now.setSeconds(0, 0); // Allow scheduling for the current minute

    if (meetingDateObj < now) {
      return res.status(400).json({
        message: "Cannot schedule a meeting in the past",
      });
    }

    const existingMeeting = await Meeting.findOne({
      date: meetingDateObj,
      status: "scheduled"
    });

    if (existingMeeting) {
      return res.status(400).json({
        message: "A meeting is already scheduled for this time slot. Please choose another time.",
      });
    }

    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const normalizedType =
      type === "Office Meeting" ? "office" : String(type).toLowerCase();

    const meeting = await Meeting.create({
      ...req.body,
      type: normalizedType,
      date: new Date(date),
      status,
    });

    lead.meetingDate = new Date(date);
    lead.status = status === "completed" ? "meeting_done" : "contacted";
    lead.lifecycleStage = "meeting_scheduled";
    lead.automation = {
      ...lead.automation,
      thankYouScheduledFor: new Date(new Date(date).getTime() + 2 * 60 * 60 * 1000),
      followupReminderFor: new Date(new Date(date).getTime() + 2 * 24 * 60 * 60 * 1000),
    };
    lead.interactionHistory = Array.isArray(lead.interactionHistory)
      ? lead.interactionHistory
      : [];
    lead.interactionHistory.push({
      type: "meeting",
      title: "Meeting scheduled",
      description: `A ${normalizedType} meeting was ${status} for ${new Date(date).toLocaleString("en-IN")}.`,
      createdAt: new Date(),
    });
    await lead.save();

    // ── SEND CONFIRMATION EMAIL ────────────────────────────────────
    if (lead.email) {
      try {
        const d = new Date(date);
        const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
        const timeStr = d.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit'
        });

        await sendEmail({
          to: lead.email,
          subject: "Meeting Confirmation - JJ Studio",
          html: getMeetingTemplate(lead.name, normalizedType, dateStr, timeStr, req.body.notes),
        });
      } catch (emailErr) {
        console.error("Failed to send meeting confirmation email:", emailErr.message);
        // Don't fail the whole request if only email fails
      }
    }

    res.status(201).json({
      message: "Meeting created successfully",
      meeting,
      lead,
    });

  } catch (err) {
    console.log("Error:", err.message);
    res.status(500).json({ message: err.message });
  }
};


const getMeetingsByLead = async (req, res) => {
  try {
    console.log(" Get Meetings API hit");

    const { leadId } = req.params;

    if (!leadId) {
      return res.status(400).json({
        message: "Lead ID is required",
      });
    }

    const meetings = await Meeting.find({ leadId })
      .populate("createdBy", "name email")
      .sort({ date: -1 });

    res.status(200).json({
      message: "Meetings fetched successfully",
      meetings,
    });

  } catch (err) {
    console.log(" Error:", err.message);
    res.status(500).json({ message: err.message });
  }
};
//  UPDATE MEETING
const updateMeeting = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        message: "Meeting ID is required",
      });
    }

    const meeting = await Meeting.findById(id);

    if (!meeting) {
      return res.status(404).json({
        message: "Meeting not found",
      });
    }

    const oldDate = meeting.date;
    const isRescheduled = req.body.date && new Date(req.body.date).getTime() !== new Date(oldDate).getTime();

    Object.assign(meeting, req.body);

    await meeting.save();

    const lead = await Lead.findById(meeting.leadId);
    
    // ── SEND RESCHEDULE EMAIL ──────────────────────────────────────
    if (lead && lead.email && isRescheduled) {
      try {
        const oldD = new Date(oldDate);
        const oldDateStr = `${String(oldD.getDate()).padStart(2, '0')}/${String(oldD.getMonth() + 1).padStart(2, '0')}/${String(oldD.getFullYear()).slice(-2)} ${oldD.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;

        const newD = new Date(req.body.date);
        const newDateStr = `${String(newD.getDate()).padStart(2, '0')}/${String(newD.getMonth() + 1).padStart(2, '0')}/${String(newD.getFullYear()).slice(-2)}`;
        const newTimeStr = newD.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit'
        });

        await sendEmail({
          to: lead.email,
          subject: "Meeting Rescheduled - JJ Studio",
          html: getMeetingRescheduleTemplate(
            lead.name, 
            meeting.type, 
            oldDateStr, 
            newDateStr, 
            newTimeStr, 
            req.body.notes || meeting.notes
          ),
        });
      } catch (emailErr) {
        console.error("Failed to send meeting reschedule email:", emailErr.message);
      }
    }

    if (lead && req.body.status) {
      if (req.body.status === "completed") {
        lead.status = "meeting_done";
        lead.lifecycleStage = "followup_due";
      } else if (req.body.status === "cancelled") {
        lead.status = "contacted";
        lead.lifecycleStage = "kit";
      } else {
        lead.status = "contacted";
        lead.lifecycleStage = "meeting_scheduled";
      }

      lead.interactionHistory = Array.isArray(lead.interactionHistory)
        ? lead.interactionHistory
        : [];
      lead.interactionHistory.push({
        type: "meeting",
        title: "Meeting updated",
        description: `Meeting status changed to ${req.body.status}.`,
        createdAt: new Date(),
      });
      await lead.save();
    }

    console.log(" Meeting updated:", meeting._id);

    res.status(200).json({
      message: "Meeting updated successfully",
      meeting,
    });

  } catch (err) {
    console.log(" Error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

//  GET ALL MEETINGS
const getAllMeetings = async (req, res) => {
  try {

    const meetings = await Meeting.find()
      .populate("leadId", "name phone city projectType siteAddress email")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "Meetings fetched successfully",
      meetings,
    });

  } catch (err) {
    console.log(" Error:", err.message);

    res.status(500).json({
      message: err.message,
    });
  }
};

// DELETE MEETING
const deleteMeeting = async (req, res) => {
  try {
    
    const { id } = req.params;

    if (!id) {
      console.log(" Meeting ID missing");
      return res.status(400).json({
        message: "Meeting ID is required",
      });
    }

    const meeting = await Meeting.findById(id);

    if (!meeting) {
      console.log(" Meeting not found");
      return res.status(404).json({
        message: "Meeting not found",
      });
    }

    await Meeting.findByIdAndDelete(id);

    console.log("Meeting deleted:", id);

    res.status(200).json({
      message: "Meeting deleted successfully",
    });

  } catch (err) {
    console.log("Error deleting meeting:", err.message);

    res.status(500).json({
      message: err.message,
    });
  }
};

const getTodayMeetings = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const todayMeetings = await Meeting.countDocuments({
      date: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    });

    res.status(200).json({
      todayMeetings,
    });

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const getTotalMeetings = async (req, res) => {
  try {
    const totalMeetings = await Meeting.countDocuments();

    res.status(200).json({
      totalMeetings,
    });

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

module.exports= {createMeeting, getMeetingsByLead, updateMeeting, getAllMeetings, deleteMeeting, getTodayMeetings,getTotalMeetings}