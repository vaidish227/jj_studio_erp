const Template = require("../models/Template.model");

exports.createTemplate = async (req, res) => {
  try {
    const { name, description, structure } = req.body;
    
    if (!name || !structure || !structure.columns || !structure.rows) {
      return res.status(400).json({ success: false, message: "Template name and valid structure are required." });
    }

    const template = new Template({
      name,
      description,
      structure,
      createdBy: req.user?._id // assuming auth middleware sets req.user
    });

    await template.save();

    res.status(201).json({
      success: true,
      message: "Template created successfully.",
      template
    });
  } catch (error) {
    console.error("Error creating template:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.getAllTemplates = async (req, res) => {
  try {
    const templates = await Template.find().sort({ updatedAt: -1 });
    res.status(200).json({
      success: true,
      templates
    });
  } catch (error) {
    console.error("Error getting templates:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await Template.findById(id);
    
    if (!template) {
      return res.status(404).json({ success: false, message: "Template not found." });
    }

    res.status(200).json({
      success: true,
      template
    });
  } catch (error) {
    console.error("Error getting template by id:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, structure } = req.body;

    const template = await Template.findById(id);
    if (!template) {
      return res.status(404).json({ success: false, message: "Template not found." });
    }

    if (name) template.name = name;
    if (description !== undefined) template.description = description;
    if (structure) template.structure = structure;

    await template.save();

    res.status(200).json({
      success: true,
      message: "Template updated successfully.",
      template
    });
  } catch (error) {
    console.error("Error updating template:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await Template.findByIdAndDelete(id);
    
    if (!template) {
      return res.status(404).json({ success: false, message: "Template not found." });
    }

    res.status(200).json({
      success: true,
      message: "Template deleted successfully."
    });
  } catch (error) {
    console.error("Error deleting template:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};
