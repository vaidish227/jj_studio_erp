const Followup = require("../models/FollowUp.model");
const Lead = require("../models/CRMClient.model");
const mongoose = require("mongoose");
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);


const createFollowup = async (req, res) => {
    try {
        const { leadId, date, note, nextFollowupDate, assignedTo } = req.body;

        if (!leadId || !isValidId(leadId) || !date) {
            return res.status(400).json({
                message: "Valid leadId and date are required",
            });
        }

        const lead = await Lead.findById(leadId);
        if (!lead) {
            console.log("Lead not found");
            return res.status(404).json({
                message: "Lead not found",
            });
        }

        const followup = await Followup.create({
            leadId,
            date,
            note,
            nextFollowupDate,
            assignedTo,
        });

        lead.status = "meeting_done";
        lead.lifecycleStage = "followup_due";
        lead.interactionHistory = Array.isArray(lead.interactionHistory)
            ? lead.interactionHistory
            : [];
        lead.interactionHistory.push({
            type: "followup",
            title: "Follow-up logged",
            description: note || "A follow-up was created for this lead.",
            createdAt: new Date(),
        });
        await lead.save();

        res.status(201).json({
            message: "Follow-up created successfully",
            followup,
        });

    } catch (error) {
        console.log(" Error:", error.message);

        res.status(500).json({
            message: error.message,
        });
    }
};
//--------------------get----------------------
const getAllFollowups = async (req, res) => {
    try {
        const followups = await Followup.find()
            .populate("leadId", "name phone")
            .populate("assignedTo", "name email")
            .sort({ createdAt: -1 });

        console.log("Followups fetched:", followups.length);

        res.status(200).json({
            message: "Followups fetched successfully",
            followups,
        });

    } catch (error) {
        console.log(" Error:", error.message);

        res.status(500).json({
            message: error.message,
        });
    }
};
//-----------------------getbylead---------------------
const getFollowupsByLead = async (req, res) => {
    try {

        const { leadId } = req.params;

        if (!leadId || !isValidId(leadId)) {
            return res.status(400).json({
                message: "Valid Lead ID is required",
            });
        }

        const followups = await Followup.find({ leadId })
            .populate("assignedTo", "name email")
            .sort({ date: -1 });

        res.status(200).json({
            message: "Followups fetched successfully",
            followups,
        });

    } catch (error) {
        console.log("Error:", error.message);

        res.status(500).json({
            message: error.message,
        });
    }
};
//------------update----------------------
const updateFollowup = async (req, res) => {
    try {
        const { id } = req.params;
        const { note, status, nextFollowupDate } = req.body;

        if (!id || !isValidId(id)) {
            return res.status(400).json({
                message: "Valid Followup ID is required",
            });
        }

        const followup = await Followup.findById(id);

        if (!followup) {
            console.log(" Followup not found");
            return res.status(404).json({
                message: "Followup not found",
            });
        }

        //  update fields (jo aayega wahi update hoga)
        if (note !== undefined) followup.note = note;
        if (status !== undefined) followup.status = status;
        if (nextFollowupDate !== undefined) followup.nextFollowupDate = nextFollowupDate;

        await followup.save();

        if (status === "done") {
            const lead = await Lead.findById(followup.leadId);
            if (lead) {
                lead.lifecycleStage = "kit";
                lead.interactionHistory = Array.isArray(lead.interactionHistory)
                    ? lead.interactionHistory
                    : [];
                lead.interactionHistory.push({
                    type: "followup",
                    title: "Follow-up completed",
                    description: note || "A follow-up was marked as done.",
                    createdAt: new Date(),
                });
                await lead.save();
            }
        }

        res.status(200).json({
            message: "Follow-up updated successfully",
            followup,
        });

    } catch (error) {
        console.log(" Error:", error.message);

        res.status(500).json({
            message: error.message,
        });
    }
};

const updateStatus = async (req, res) => {
    try {
        const followup = await Followup.findByIdAndUpdate(
            req.params.id,
            { status: req.body.status },
            { new: true }
        );

        res.json(followup);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

//----------delete-------------
const deleteFollowup = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            console.log(" Followup ID missing");
            return res.status(400).json({
                message: "Followup ID is required",
            });
        }

        const followup = await Followup.findById(id);

        if (!followup) {
            console.log(" Followup not found");
            return res.status(404).json({
                message: "Followup not found",
            });
        }

        await Followup.findByIdAndDelete(id);

        console.log("Follow-up deleted:", id);

        res.status(200).json({
            message: "Follow-up deleted successfully",
        });

    } catch (error) {
        console.log(" Error deleting follow-up:", error.message);

        res.status(500).json({
            message: error.message,
        });
    }
};

const getPendingFollowups = async (req, res) => {
    try {
        const pendingFollowups = await Followup.countDocuments({
            status: "pending",
        });

        res.status(200).json({
            pendingFollowups,
        });

    } catch (error) {
        res.status(500).json({
            message: error.message,
        });
    }
};

module.exports = { createFollowup, getAllFollowups, getFollowupsByLead, updateFollowup, updateStatus, deleteFollowup, getPendingFollowups };