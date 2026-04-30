const Activity = require("../models/Activity.model");
const mongoose = require("mongoose");

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const createActivity = async (req, res) => {
  try {
    const { proposalId, action, note, createdBy } = req.body;

    if (!proposalId || !action) {
      return res.status(400).json({
        message: "proposalId and action are required",
      });
    }

    if (!isValidId(proposalId)) {
      return res.status(400).json({ message: "Invalid proposalId" });
    }

    const activity = await Activity.create({
      proposalId,
      action,
      note,
      createdBy,
    });

    res.status(201).json({
      success: true,
      data: activity,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getActivitiesByProposal = async (req, res) => {
  try {
    const { proposalId } = req.params;

    if (!isValidId(proposalId)) {
      return res.status(400).json({ message: "Invalid proposalId" });
    }

    const activities = await Activity.find({ proposalId })
      .populate("createdBy")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: activities,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createActivity, getActivitiesByProposal }