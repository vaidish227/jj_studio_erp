const Lead = require("../models/Lead.model");
const Client = require("../models/Client.model");

const createLead = async (req, res) => {
    try {

        const { name, phone } = req.body;
        if (!name || !phone) {
            console.log(" Missing required fields");
            return res.status(400).json({
                message: "Name and phone are required",
            });
        }

        const lead = await Lead.create(req.body);

        console.log(" Lead created:", lead._id);

        res.status(201).json({
            message: "Lead created successfully",
            lead,
        });

    } catch (error) {
        console.log(" Error:", error.message);

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

        const skip = (page - 1) * limit;

        const query = status ? { status } : {};

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


module.exports = { createLead, getLeads, getLeadById, updateLead, updateLeadStatus, deleteLead , convertLeadToClient};