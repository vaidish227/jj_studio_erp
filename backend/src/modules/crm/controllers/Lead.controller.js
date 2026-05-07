/**
 * @deprecated This controller is deprecated. Use CRMClient.controller.js instead.
 * All lead lifecycle operations are now handled by the unified CRMClient controller.
 */
const Lead = require("../models/Lead.model");
const Client = require("../models/Client.model");
require("dotenv").config();
const sendEmail = require("../utils/sendEmail");
const getLeadTemplate = require("../utils/Template/leadTemplate");
const getReferrerTemplate = require("../utils/Template/referrerTemplate");

const validStatus = [
    "new",
    "contacted",
    "meeting_done",
    "proposal_sent",
    "converted",
    "lost",
];

const appendInteraction = (lead, entry) => {
    lead.interactionHistory = Array.isArray(lead.interactionHistory)
        ? lead.interactionHistory
        : [];

    lead.interactionHistory.push({
        createdAt: new Date(),
        ...entry,
    });
};

const createLead = async (req, res) => {
    try {
        const { name, phone, email, referrerName, referrerEmail } = req.body;

        if (!name || !phone || !email) {
            return res.status(400).json({
                message: "Name, phone and email are required",
            });
        }

        const existingLead = await Lead.findOne({
            $or: [{ phone }, { email }],
        });

        if (existingLead) {
            return res.status(400).json({
                message: "Lead already exists with same phone or email",
            });
        }

        const lead = await Lead.create({
            ...req.body,
            lifecycleStage: "enquiry",
            interactionHistory: [
                {
                    type: "status_change",
                    title: "Enquiry captured",
                    description: "A new enquiry was submitted and added to the CRM pipeline.",
                },
            ],
        });

        console.log("Lead created:", lead._id);

        // Referrer email
        if (referrerName && referrerEmail) {
            await sendEmail({
                to: referrerEmail,
                subject: "Thank You for Your Referral",
                html: getReferrerTemplate(referrerName, name),
            });
        }

        res.status(201).json({
            message: "Lead created successfully",
            lead,
        });

    } catch (error) {
        console.log("Error:", error.message);

        res.status(500).json({
            message: error.message,
        });
    }
};
//---------------------------------get---------------------
const getLeads = async (req, res) => {
    try {

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status;
        const lifecycleStage = req.query.lifecycleStage;
        const projectType = req.query.projectType;

        const skip = (page - 1) * limit;

        const query = {};
        if (status) query.status = status;
        if (lifecycleStage) query.lifecycleStage = lifecycleStage;
        if (projectType) query.projectType = projectType;

        const leads = await Lead.find(query)
            .sort({ createdAt: -1 }) // latest first
            .skip(skip)
            .limit(limit);

        const total = await Lead.countDocuments(query);

        res.status(200).json({
            message: "Leads fetched successfully",
            total,
            page,
            limit,
            leads,
        });

    } catch (error) {
        console.log(" Error fetching leads:", error.message);

        res.status(500).json({
            message: error.message,
        });
    }
};

//---------------------------getbyid----------------------------
const getLeadById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            console.log(" Lead ID missing");
            return res.status(400).json({
                message: "Lead ID is required",
            });
        }

        const lead = await Lead.findById(id);

        if (!lead) {
            console.log(" Lead not found");
            return res.status(404).json({
                message: "Lead not found",
            });
        }

        res.status(200).json({
            message: "Lead fetched successfully",
            lead,
        });

    } catch (error) {
        console.log(" Error:", error.message);

        res.status(500).json({
            message: error.message,
        });
    }
};
//-----------------update-------------
const updateLead = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            console.log("Lead ID missing");
            return res.status(400).json({
                message: "Lead ID is required",
            });
        }

        const lead = await Lead.findById(id);

        if (!lead) {
            console.log(" Lead not found");
            return res.status(404).json({
                message: "Lead not found",
            });
        }

        Object.assign(lead, req.body);
        if (req.body.notes) {
            appendInteraction(lead, {
                type: "note",
                title: "Lead note updated",
                description: req.body.notes,
            });
        }

        await lead.save();

        console.log(" Lead updated:", lead._id);

        res.status(200).json({
            message: "Lead updated successfully",
            lead,
        });

    } catch (error) {
        console.log(" Error updating lead:", error.message);

        res.status(500).json({
            message: error.message,
        });
    }
};
//------------------------update status----------------------------
const updateLeadStatus = async (req, res) => {
    try {

        const { id } = req.params;
        const { status } = req.body;

        if (!id) {
            console.log("Lead ID missing");
            return res.status(400).json({
                message: "Lead ID is required",
            });
        }
        if (!status) {
            console.log(" Status missing");
            return res.status(400).json({
                message: "Status is required",
            });
        }
        if (!validStatus.includes(status)) {
            console.log(" Invalid status");
            return res.status(400).json({
                message: "Invalid status value",
            });
        }
        const lead = await Lead.findById(id);
        if (!lead) {
            console.log(" Lead not found");
            return res.status(404).json({
                message: "Lead not found",
            });
        }
        lead.status = status;
        const lifecycleByStatus = {
            new: "enquiry",
            contacted: "kit",
            meeting_done: "followup_due",
            proposal_sent: "proposal_sent",
            converted: "converted",
            lost: "lost",
        };
        if (lifecycleByStatus[status]) {
            lead.lifecycleStage = lifecycleByStatus[status];
        }
        appendInteraction(lead, {
            type: "status_change",
            title: "Lead status updated",
            description: `Status changed to ${status.replace(/_/g, " ")}.`,
        });
        await lead.save();

        console.log(" Status updated:", lead.status);
        res.status(200).json({
            message: "Lead status updated successfully",
            lead,
        });

    } catch (error) {
        console.log(" Error:", error.message);
        res.status(500).json({
            message: error.message,
        });
    }
};

//--------------------delete-----------------------------
const deleteLead = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            console.log(" Lead ID missing");
            return res.status(400).json({
                message: "Lead ID is required",
            });
        }

        const lead = await Lead.findById(id);

        if (!lead) {
            console.log(" Lead not found");
            return res.status(404).json({
                message: "Lead not found",
            });
        }

        await Lead.findByIdAndDelete(id);

        res.status(200).json({
            message: "Lead deleted successfully",
        });

    } catch (error) {
        console.log(" Error deleting lead:", error.message);

        res.status(500).json({
            message: error.message,
        });
    }
};

const convertLeadToClient = async (req, res) => {
    try {
        const { id } = req.params;

        const lead = await Lead.findById(id);

        if (!lead) {
            return res.status(404).json({ message: "Lead not found" });
        }

        if (lead.status === "converted" && lead.clientId) {
            return res.status(400).json({
                message: "Lead already converted",
            });
        }

        let client = lead.clientId ? await Client.findById(lead.clientId) : null;
        if (!client) {
            client = await Client.create({
                leadId: lead._id,
                name: lead.name,
                phone: lead.phone,
                email: lead.email,
            });
        }

        // update lead
        lead.status = "converted";
        lead.clientId = client._id;
        lead.convertedAt = new Date();
        lead.lifecycleStage = "converted";
        appendInteraction(lead, {
            type: "status_change",
            title: "Lead converted",
            description: "Lead moved into the converted/project-ready stage.",
        });

        await lead.save();

        res.json({
            message: "Lead converted successfully",
            client,
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

//total lead----
const getTotalLeads = async (req, res) => {
  try {
    const totalLeads = await Lead.countDocuments();

    res.status(200).json({
      totalLeads,
    });

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const getConvertedLeads = async (req, res) => {
  try {
    const convertedLeads = await Lead.countDocuments({
      status: "converted",
    });

    res.status(200).json({
      convertedLeads,
    });

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const triggerThankYouAutomation = async (req, res) => {
    try {
        const { id } = req.params;
        const lead = await Lead.findById(id);

        if (!lead) {
            return res.status(404).json({ message: "Lead not found" });
        }

        if (!lead.email) {
            return res.status(400).json({ message: "Lead email not found" });
        }

        await sendEmail({
            to: lead.email,
            subject: "Thank You for Meeting with JJ Studio",
            html: getLeadTemplate(lead.name),
        });

        lead.automation = {
            ...lead.automation,
            thankYouSentAt: new Date(),
        };
        lead.lifecycleStage = "thank_you_sent";
        appendInteraction(lead, {
            type: "thank_you",
            title: "Automated thank you sent",
            description: "The post-meeting thank you message was triggered.",
        });

        await lead.save();

        res.status(200).json({
            message: "Thank you message sent successfully",
            lead,
        });
    } catch (error) {
        res.status(500).json({
            message: error.message,
        });
    }
};

const recordShowProject = async (req, res) => {
    try {
        const { id } = req.params;
        const lead = await Lead.findById(id);

        if (!lead) {
            return res.status(404).json({ message: "Lead not found" });
        }

        lead.showProject = {
            ...lead.showProject,
            ...req.body,
            showcasedAt: req.body.showcasedAt || new Date(),
        };
        lead.lifecycleStage = "show_project";
        appendInteraction(lead, {
            type: "show_project",
            title: "Project showcase updated",
            description: req.body.siteVisitNote || "Project references and showcase details were updated.",
        });

        await lead.save();

        res.status(200).json({
            message: "Project showcase updated successfully",
            lead,
        });
    } catch (error) {
        res.status(500).json({
            message: error.message,
        });
    }
};

const recordAdvancePayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, note, receivedAt } = req.body;
        const lead = await Lead.findById(id);

        if (!lead) {
            return res.status(404).json({ message: "Lead not found" });
        }

        lead.advancePayment = {
            received: true,
            amount,
            note,
            receivedAt: receivedAt || new Date(),
            movedToProjectManagement: true,
            movedAt: new Date(),
        };
        lead.lifecycleStage = "project_moved";
        lead.status = "converted";
        appendInteraction(lead, {
            type: "advance_payment",
            title: "Advance payment received",
            description: note || "Advance payment recorded and marked ready for project management handoff.",
        });

        await lead.save();

        res.status(200).json({
            message: "Advance payment recorded successfully",
            lead,
        });
    } catch (error) {
        res.status(500).json({
            message: error.message,
        });
    }
};



module.exports = {
    createLead,
    getLeads,
    getLeadById,
    updateLead,
    updateLeadStatus,
    deleteLead,
    convertLeadToClient,
    getTotalLeads,
    getConvertedLeads,
    triggerThankYouAutomation,
    recordShowProject,
    recordAdvancePayment,
};