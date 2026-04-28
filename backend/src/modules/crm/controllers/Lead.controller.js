const Lead = require("../models/Lead.model");
const Client = require("../models/Client.model");
const nodemailer = require("nodemailer");
require("dotenv").config();
const sendEmail = require("../utils/sendEmail");
const getLeadTemplate = require("../utils/Template/leadTemplate");
const getReferrerTemplate = require("../utils/Template/referrerTemplate");

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

        const lead = await Lead.create(req.body);

        console.log("Lead created:", lead._id);

        // Lead email
        if (email) {
            await sendEmail({
                to: email,
                subject: "Thank You for Contacting JJ Studio",
                html: getLeadTemplate(name),
            });
        }

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

        const skip = (page - 1) * limit;

        const leads = await Lead.find()
            .sort({ createdAt: -1 }) // latest first
            .skip(skip)
            .limit(limit);

        const total = await Lead.countDocuments();

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
        const validStatus = [
            "new",
            "contacted",
            "meeting_done",
            "proposal_sent",
            "converted",
            "lost",
        ];
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

        if (lead.status === "converted") {
            return res.status(400).json({
                message: "Lead already converted",
            });
        }

        //  create client
        const client = await Client.create({
            leadId: lead._id,
            name: lead.name,
            phone: lead.phone,
            email: lead.email,
        });

        // update lead
        lead.status = "converted";
        lead.clientId = client._id;
        lead.convertedAt = new Date();

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



module.exports = { createLead, getLeads, getLeadById, updateLead, updateLeadStatus, deleteLead, convertLeadToClient , getTotalLeads, getConvertedLeads};