const BOQItem = require("../models/Boq_item.model");
const BOQ = require("../models/Boq.model");
const mongoose = require("mongoose");

const VALID_CATEGORIES = ["carpentry", "electrical", "false_ceiling", "marble", "plumbing", "civil"];
const VALID_UNITS = ["sqft", "rft", "nos", "job", "lump_sum"];

const addBOQItem = async (req, res) => {
    try {
        const { boqId, name, qty, rate, unit, category } = req.body;

        if (!boqId || !name || qty == null || rate == null || !category) {
            return res.status(400).json({
                message: "boqId, name, qty, rate, category are required",
            });
        }

        if (!VALID_CATEGORIES.includes(category)) {
            return res.status(400).json({ message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` });
        }

        if (unit && !VALID_UNITS.includes(unit)) {
            return res.status(400).json({ message: `Invalid unit. Must be one of: ${VALID_UNITS.join(", ")}` });
        }

        const qtyNum = Number(qty);
        const rateNum = Number(rate);
        if (Number.isNaN(qtyNum) || Number.isNaN(rateNum)) {
            return res.status(400).json({ message: "qty and rate must be numbers" });
        }

        if (!mongoose.Types.ObjectId.isValid(boqId)) {
            return res.status(400).json({ message: "Invalid BOQ id" });
        }

        const boq = await BOQ.findById(boqId);
        if (!boq) {
            return res.status(404).json({ message: "BOQ not found" });
        }

        if (boq.status === "finalized") {
            return res.status(400).json({
                message: "Cannot add items to finalized BOQ",
            });
        }

        const amount = qtyNum * rateNum;

        const item = await BOQItem.create({
            boqId,
            name,
            qty: qtyNum,
            rate: rateNum,
            unit,
            category,
            amount,
        });

        //  Recalculate BOQ totals
        const items = await BOQItem.find({ boqId });

        const totalAmount = items.reduce((sum, i) => sum + i.amount, 0);
        const gst = totalAmount * 0.18;
        const finalAmount = totalAmount + gst;

        boq.totalAmount = totalAmount;
        boq.gst = gst;
        boq.finalAmount = finalAmount;

        await boq.save();

        res.status(201).json({
            success: true,
            data: item,
            boqSummary: {
                totalAmount,
                gst,
                finalAmount,
            },
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { addBOQItem };