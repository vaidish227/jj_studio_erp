
const Template = require("../models/Template.model")
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
    const { type } = req.query;

    let filter = {};

    if (type) {
      if (!["residential", "commercial"].includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid type",
        });
      }
      filter.type = type;
    }

    const templates = await Template.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: templates,
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
