const WhatsAppTemplate = require("../models/WhatsAppTemplate.model");
const { createTemplateSchema, updateTemplateSchema } = require("../validator/WhatsApp.validator");

const createTemplate = async (req, res) => {
  try {
    const { error, value } = createTemplateSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details.map((d) => d.message).join(", ") });

    const existing = await WhatsAppTemplate.findOne({ name: value.name });
    if (existing) return res.status(409).json({ message: "A template with this name already exists" });

    const template = await WhatsAppTemplate.create({ ...value, createdBy: req.user._id });
    res.status(201).json({ message: "WhatsApp template created", data: template });
  } catch (err) {
    console.error("[createWhatsAppTemplate]", err);
    res.status(500).json({ message: err.message });
  }
};

const getTemplates = async (req, res) => {
  try {
    const { category, isActive, page = 1, limit = 50 } = req.query;
    const query = {};
    if (category)               query.category = category;
    if (isActive !== undefined) query.isActive = isActive === "true";

    const [templates, total] = await Promise.all([
      WhatsAppTemplate.find(query)
        .sort({ category: 1, name: 1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .populate("createdBy", "name")
        .lean(),
      WhatsAppTemplate.countDocuments(query),
    ]);

    res.status(200).json({ message: "WhatsApp templates fetched", data: { templates, total } });
  } catch (err) {
    console.error("[getWhatsAppTemplates]", err);
    res.status(500).json({ message: err.message });
  }
};

const getTemplateById = async (req, res) => {
  try {
    const template = await WhatsAppTemplate.findById(req.params.id).populate("createdBy", "name");
    if (!template) return res.status(404).json({ message: "WhatsApp template not found" });
    res.status(200).json({ message: "WhatsApp template fetched", data: template });
  } catch (err) {
    console.error("[getWhatsAppTemplateById]", err);
    res.status(500).json({ message: err.message });
  }
};

const updateTemplate = async (req, res) => {
  try {
    const { error, value } = updateTemplateSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details.map((d) => d.message).join(", ") });

    if (value.name) {
      const clash = await WhatsAppTemplate.findOne({ name: value.name, _id: { $ne: req.params.id } });
      if (clash) return res.status(409).json({ message: "A template with this name already exists" });
    }

    const template = await WhatsAppTemplate.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    );
    if (!template) return res.status(404).json({ message: "WhatsApp template not found" });

    res.status(200).json({ message: "WhatsApp template updated", data: template });
  } catch (err) {
    console.error("[updateWhatsAppTemplate]", err);
    res.status(500).json({ message: err.message });
  }
};

const deleteTemplate = async (req, res) => {
  try {
    const template = await WhatsAppTemplate.findByIdAndDelete(req.params.id);
    if (!template) return res.status(404).json({ message: "WhatsApp template not found" });
    res.status(200).json({ message: "WhatsApp template deleted" });
  } catch (err) {
    console.error("[deleteWhatsAppTemplate]", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createTemplate, getTemplates, getTemplateById, updateTemplate, deleteTemplate };
