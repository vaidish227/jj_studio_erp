const KitTemplate = require("../models/KitTemplate.model");
const {
  createTemplateSchema, updateTemplateSchema, previewSchema,
} = require("../validators/template.validator");
const {
  VARIABLES, getVariablesForEntity, findUnknownVariables,
} = require("../constants/variableCatalog");
const variableResolver = require("../services/variableResolver");

// The body fields that may contain {{variables}} — used for unknown-token checks.
const TEXT_FIELDS = ["subject", "htmlBody", "textBody", "body", "title"];

const collectUnknownVars = (doc) => {
  const blob = TEXT_FIELDS.map((f) => doc[f] || "").join(" ");
  return findUnknownVariables(blob);
};

// ─── CRUD ───────────────────────────────────────────────────────────────────
const createTemplate = async (req, res) => {
  try {
    const { error, value } = createTemplateSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details.map((d) => d.message).join(", ") });

    const unknown = collectUnknownVars(value);
    if (unknown.length) return res.status(400).json({ message: `Unknown variables: ${unknown.map((v) => `{{${v}}}`).join(", ")}` });

    const existing = await KitTemplate.findOne({ name: value.name });
    if (existing) return res.status(409).json({ message: "A template with this name already exists" });

    const template = await KitTemplate.create({ ...value, createdBy: req.user._id });
    res.status(201).json({ message: "Template created", data: template });
  } catch (err) {
    console.error("[kit.createTemplate]", err);
    res.status(500).json({ message: err.message });
  }
};

const getTemplates = async (req, res) => {
  try {
    const { channel, category, isActive, page = 1, limit = 50 } = req.query;
    const query = {};
    if (channel)  query.channel = channel;
    if (category) query.category = category;
    if (isActive !== undefined) query.isActive = isActive === "true";

    const [templates, total] = await Promise.all([
      KitTemplate.find(query)
        .sort({ channel: 1, category: 1, name: 1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .populate("createdBy", "name")
        .lean(),
      KitTemplate.countDocuments(query),
    ]);

    res.status(200).json({ message: "Templates fetched", data: { templates, total } });
  } catch (err) {
    console.error("[kit.getTemplates]", err);
    res.status(500).json({ message: err.message });
  }
};

const getTemplateById = async (req, res) => {
  try {
    const template = await KitTemplate.findById(req.params.id).populate("createdBy", "name");
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.status(200).json({ message: "Template fetched", data: template });
  } catch (err) {
    console.error("[kit.getTemplateById]", err);
    res.status(500).json({ message: err.message });
  }
};

const updateTemplate = async (req, res) => {
  try {
    const { error, value } = updateTemplateSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details.map((d) => d.message).join(", ") });

    const unknown = collectUnknownVars(value);
    if (unknown.length) return res.status(400).json({ message: `Unknown variables: ${unknown.map((v) => `{{${v}}}`).join(", ")}` });

    if (value.name) {
      const clash = await KitTemplate.findOne({ name: value.name, _id: { $ne: req.params.id } });
      if (clash) return res.status(409).json({ message: "A template with this name already exists" });
    }

    const template = await KitTemplate.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    );
    if (!template) return res.status(404).json({ message: "Template not found" });

    res.status(200).json({ message: "Template updated", data: template });
  } catch (err) {
    console.error("[kit.updateTemplate]", err);
    res.status(500).json({ message: err.message });
  }
};

const deleteTemplate = async (req, res) => {
  try {
    const template = await KitTemplate.findByIdAndDelete(req.params.id);
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.status(200).json({ message: "Template deleted" });
  } catch (err) {
    console.error("[kit.deleteTemplate]", err);
    res.status(500).json({ message: err.message });
  }
};

// ─── Variable catalog (for the editor's variable picker) ──────────────────────
const getVariables = async (req, res) => {
  try {
    const { entity } = req.query;
    const variables = entity ? getVariablesForEntity(entity) : VARIABLES;
    res.status(200).json({ message: "Variables fetched", data: { variables, samples: variableResolver.sampleValues() } });
  } catch (err) {
    console.error("[kit.getVariables]", err);
    res.status(500).json({ message: err.message });
  }
};

// ─── Render preview ───────────────────────────────────────────────────────────
const previewTemplate = async (req, res) => {
  try {
    const { error, value } = previewSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details.map((d) => d.message).join(", ") });

    // Layer variables: sample defaults < resolved entity data < explicit overrides.
    let vars = variableResolver.sampleValues();
    if (value.entityType && value.entityId) {
      const resolved = await variableResolver.resolve(value.entityType, value.entityId);
      vars = { ...vars, ...resolved };
    }
    if (value.variables) vars = { ...vars, ...value.variables };

    const rendered = {};
    for (const f of TEXT_FIELDS) {
      if (value[f] !== undefined) rendered[f] = variableResolver.render(value[f], vars);
    }

    res.status(200).json({
      message: "Preview rendered",
      data: { rendered, usedVariables: vars, unknownVariables: collectUnknownVars(value) },
    });
  } catch (err) {
    console.error("[kit.previewTemplate]", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createTemplate, getTemplates, getTemplateById, updateTemplate, deleteTemplate,
  getVariables, previewTemplate,
};
