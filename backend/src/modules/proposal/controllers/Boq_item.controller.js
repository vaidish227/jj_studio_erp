const BOQItem = require("../../crm/models/Boq_item.model");
const BOQ = require("../../crm/models/Boq.model");
const mongoose = require("mongoose");

const addBOQItem = async (req, res) => {
    try {
        const { boqId, name, qty, rate, unit, category } = req.body;

        //  Validation
        if (!boqId || !name || !qty || !rate) {
            return res.status(400).json({
                message: "boqId, name, qty, rate are required",
            });
        } s

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

        //  Calculate amount
        const amount = qty * rate;

        //  Create item
        const item = await BOQItem.create({
            boqId,
            name,
            qty,
            rate,
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