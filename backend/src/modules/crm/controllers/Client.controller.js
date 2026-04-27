const Client = require("../models/Client.model");
const Lead = require("../models/Lead.model");

const createClient = async (req, res) => {
    try {
        const {
            name,
            phone,
            email,
            address,
            dob,
            companyName,
            officeAddress,
            spouse,
            children,
            siteAddress,
            leadId,
        } = req.body;

        if (!name || !phone) {
            console.log(" Name or phone missing");
            return res.status(400).json({
                message: "Name and phone are required",
            });
        }

        if (leadId) {
            const lead = await Lead.findById(leadId);

            if (!lead) {
                console.log(" Lead not found");
                return res.status(404).json({
                    message: "Lead not found",
                });
            }

            if (lead.status !== "converted") {
                console.log(" Lead not converted");
                return res.status(400).json({
                    message: "Lead must be converted to create client",
                });
            }
        }

        const client = await Client.create({
            name,
            phone,
            email,
            address,
            dob,
            companyName,
            officeAddress,
            spouse,
            children,
            siteAddress,
            leadId,
        });

        console.log(" Client created:", client._id);

        res.status(201).json({
            message: "Client created successfully",
            client,
        });

    } catch (error) {
        console.log("Error:", error.message);

        res.status(500).json({
            message: error.message,
        });
    }
};
//---------------------------get---------------------------
const getClients = async (req, res) => {
    try {
        // pagination (optional but useful)
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const skip = (page - 1) * limit;

        const clients = await Client.find()
            .populate("leadId")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Client.countDocuments();

        res.status(200).json({
            message: "Clients fetched successfully",
            total,
            page,
            limit,
            clients,
        });

    } catch (error) {
        console.log("Error:", error.message);

        res.status(500).json({
            message: error.message,
        });
    }
};
//-------------------getbyid--------------------------------


const getClientById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            console.log(" Client ID missing");
            return res.status(400).json({
                message: "Client ID is required",
            });
        }
        const client = await Client.findById(id).populate("leadId");

        if (!client) {
            console.log(" Client not found");
            return res.status(404).json({
                message: "Client not found",
            });
        }

        res.status(200).json({
            message: "Client fetched successfully",
            client,
        });

    } catch (error) {
        console.log("Error:", error.message);

        res.status(500).json({
            message: error.message,
        });
    }
};
//----------------update------------------

const updateClient = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            console.log(" Client ID missing");
            return res.status(400).json({
                message: "Client ID is required",
            });
        }

        const client = await Client.findById(id);

        if (!client) {
            console.log(" Client not found");
            return res.status(404).json({
                message: "Client not found",
            });
        }

        Object.assign(client, req.body);

        await client.save();

        console.log("Client updated:", client._id);

        res.status(200).json({
            message: "Client updated successfully",
            client,
        });

    } catch (error) {
        console.log(" Error updating client:", error.message);

        res.status(500).json({
            message: error.message,
        });
    }
};
//------------delete--------------
const deleteClient = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            console.log(" Client ID missing");
            return res.status(400).json({
                message: "Client ID is required",
            });
        }

        const client = await Client.findById(id);

        if (!client) {
            console.log("Client not found");
            return res.status(404).json({
                message: "Client not found",
            });
        }

        await Client.findByIdAndDelete(id);

        console.log("Client deleted:", id);

        res.status(200).json({
            message: "Client deleted successfully",
        });

    } catch (error) {
        console.log("Error deleting client:", error.message);

        res.status(500).json({
            message: error.message,
        });
    }
};
module.exports = { createClient, getClients, getClientById, updateClient, deleteClient };