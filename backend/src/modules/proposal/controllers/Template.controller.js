
const Template = require("../models/Template.model");
const Proposal = require("../../crm/models/Proposal.model");
const createTemplate = async (req, res) => {
  try {
    const { name, type, description, structure } = req.body;

    // validation
    if (!name || !type) {
      return res.status(400).json({
        success: false,
        message: "name and type are required",
      });
    }

    if (!["residential", "commercial"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid template type",
      });
    }

    const template = await Template.create({
      name,
      type,
      description,
      structure: structure || { columns: [], rows: [] },
      createdBy: req.user?.id || null,
    });

    res.status(201).json({
      success: true,
      data: template,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getTemplates = async (req, res) => {
  try {
    const { type, search } = req.query;

    // Pagination — defaults keep current callers (which pass no params) working,
    // capped at 200 so a future caller can't accidentally request the whole table. (#37)
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip  = (page - 1) * limit;

    const filter = {};
    if (type) {
      if (!["residential", "commercial"].includes(type)) {
        return res.status(400).json({ success: false, message: "Invalid type" });
      }
      filter.type = type;
    }
    if (search && search.trim()) {
      // Anchored to start so it stays index-friendly; not a regex DoS surface
      // because we escape the user input.
      const safe = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.name = { $regex: safe, $options: "i" };
    }

    const [templates, total] = await Promise.all([
      Template.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Template.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: templates,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

 const getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;

    const template = await Template.findById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template not found",
      });
    }

    res.status(200).json({
      success: true,
      data: template,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const allowedFields = ["name", "type", "description", "structure"];
    const updateData = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    if (updateData.type && !["residential", "commercial"].includes(updateData.type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid type",
      });
    }

    const template = await Template.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template not found",
      });
    }

    res.status(200).json({
      success: true,
      data: template,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

 const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await Template.findById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template not found",
      });
    }

    // Refuse to delete if any proposal still references this template — silent
    // hard-delete would null out templateId on those proposals (#17).
    const inUse = await Proposal.countDocuments({ templateId: id });
    if (inUse > 0) {
      return res.status(409).json({
        success: false,
        message: `Template is used by ${inUse} proposal${inUse === 1 ? "" : "s"} and cannot be deleted.`,
        proposalsUsing: inUse,
      });
    }

    await Template.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Template deleted successfully",
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {createTemplate, getTemplates, getTemplateById, updateTemplate, deleteTemplate }
