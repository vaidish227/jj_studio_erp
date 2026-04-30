const BOQ = require("../models/Boq.model");
const Proposal = require("../../crm/models/Proposal.model");
const mongoose = require("mongoose");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const createBOQ = async (req, res) => {
    try {
        const { proposalId, title } = req.body;

        //  1. Required validation
        if (!proposalId) {
            return res.status(400).json({
                success: false,
                message: "proposalId is required",
            });
        }

        //  2. ObjectId validation
        if (!mongoose.Types.ObjectId.isValid(proposalId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid proposalId",
            });
        }

        //  3. Proposal existence check
        const proposal = await Proposal.findById(proposalId);
        if (!proposal) {
            return res.status(404).json({
                success: false,
                message: "Proposal not found",
            });
        }

        //  4. Check if BOQ already exists (avoid duplicate)
        if (proposal.boqId) {
            return res.status(400).json({
                success: false,
                message: "BOQ already exists for this proposal",
            });
        }

        //  5. Create BOQ
        const boq = await BOQ.create({
            proposalId,
            title: title || "BOQ",
            totalAmount: 0,
            gst: 0,
            finalAmount: 0,
        });

        //  6. Link BOQ to Proposal
        proposal.boqId = boq._id;
        await proposal.save();

        res.status(201).json({
            success: true,
            message: "BOQ created successfully",
            data: boq,
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const getAllBOQ = async (req, res) => {
    try {
        const { proposalId } = req.query;

        let filter = {};

        if (proposalId) {
            if (!isValidObjectId(proposalId)) {
                return res.status(400).json({ message: "Invalid proposalId" });
            }
            filter.proposalId = proposalId;
        }

        const boq = await BOQ.find(filter)
            .populate("proposalId")
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, data: boq });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const getBOQById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid BOQ id" });
        }

        const boq = await BOQ.findById(id).populate("proposalId");

        if (!boq) {
            return res.status(404).json({ message: "BOQ not found" });
        }

        res.status(200).json({ success: true, data: boq });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const updateBOQ = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid BOQ id" });
        }

        const allowedFields = ["title"];
        const updateData = {};

        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        });

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ message: "No valid fields to update" });
        }

        const boq = await BOQ.findByIdAndUpdate(id, updateData, { new: true });

        if (!boq) {
            return res.status(404).json({ message: "BOQ not found" });
        }

        res.status(200).json({ success: true, data: boq });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const deleteBOQ = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid BOQ id" });
        }

        const boq = await BOQ.findById(id);

        if (!boq) {
            return res.status(404).json({ message: "BOQ not found" });
        }

        await BOQ.findByIdAndDelete(id);

        res.status(200).json({ success: true, message: "BOQ deleted" });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { createBOQ, getAllBOQ, getBOQById, updateBOQ, deleteBOQ };