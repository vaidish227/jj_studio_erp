const Meeting = require("../models/Metting.model");


const createMeeting = async (req, res) => {
  try {
    const { leadId, date, type } = req.body;

    if (!leadId || !date || !type) {
      console.log("Required fields missing");
      return res.status(400).json({
        message: "leadId, date and type are required",
      });
    }

    const meeting = await Meeting.create(req.body);
    res.status(201).json({
      message: "Meeting created successfully",
      meeting,
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

    Object.assign(meeting, req.body);

    await meeting.save();

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

module.exports= {createMeeting, getMeetingsByLead, updateMeeting, getAllMeetings, deleteMeeting}