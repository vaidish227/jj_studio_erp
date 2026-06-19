const KitTemplate = require("../models/KitTemplate.model");
const {
  createTemplateSchema, updateTemplateSchema, previewSchema,
} = require("../validators/template.validator");
const {
  VARIABLES, getVariablesForEntity, findUnknownVariables,
} = require("../constants/variableCatalog");
const variableResolver = require("../services/variableResolver");
const { wrapEmailHtml } = require("../../mail/service/emailLayout");
const { resolveEmailDesign } = require("../services/emailDesignService");
const s3 = require("../../pms/services/s3Storage");

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
    const out = template.toObject();
    // Refresh signed URLs for uploaded media so the editor preview renders.
    if (s3.isConfigured()) {
      if (out.mediaKey) {
        try { out.mediaUrl = await s3.getSignedDownloadUrl({ key: out.mediaKey, expiresIn: 3600, disposition: "inline" }); } catch { /* keep stored url */ }
      }
      if (Array.isArray(out.attachments)) {
        for (const a of out.attachments) {
          if (a && a.key) { try { a.url = await s3.getSignedDownloadUrl({ key: a.key, expiresIn: 3600, disposition: "inline" }); } catch { /* keep */ } }
        }
      }
      if (out.emailDesign && out.emailDesign.logoKey) {
        try { out.emailDesign.logoUrl = await s3.getSignedDownloadUrl({ key: out.emailDesign.logoKey, expiresIn: 3600, disposition: "inline" }); } catch { /* keep stored url */ }
      }
    }
    res.status(200).json({ message: "Template fetched", data: out });
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

    // Email content is authored as a body; show the branded wrapper (global design
    // merged with this template's draft overrides) so the live preview matches
    // exactly what gets sent.
    if (value.channel === "email" && rendered.htmlBody !== undefined) {
      const design = await resolveEmailDesign(value.emailDesign);
      rendered.htmlBody = wrapEmailHtml(rendered.htmlBody, design);
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

// ── Media upload (WhatsApp image / document / video) ──────────────────────────
const KIT_MEDIA_PREFIX = (process.env.S3_KIT_MEDIA_PREFIX || "kit-media").replace(/^\/+|\/+$/g, "");

const uploadMedia = async (req, res) => {
  try {
    if (req.fileFilterError) return res.status(400).json({ message: req.fileFilterError });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    if (!s3.isConfigured()) {
      return res.status(503).json({ message: "File storage is not configured on the server (set AWS_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / S3_BUCKET)." });
    }

    const orig = req.file.originalname || "file";
    const dot  = orig.lastIndexOf(".");
    const ext  = (dot >= 0 ? orig.slice(dot + 1) : "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
    const base = s3.slugify(dot >= 0 ? orig.slice(0, dot) : orig, "media");
    const key  = `${KIT_MEDIA_PREFIX}/${base}-${Date.now()}.${ext}`;

    await s3.putObject({ key, body: req.file.buffer, contentType: req.file.mimetype });
    const url = await s3.getSignedDownloadUrl({ key, expiresIn: 3600, disposition: "inline", filename: orig });

    return res.status(201).json({ message: "Uploaded", data: { key, url, filename: orig, mimetype: req.file.mimetype } });
  } catch (err) {
    console.error("[kit.uploadMedia]", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createTemplate, getTemplates, getTemplateById, updateTemplate, deleteTemplate,
  getVariables, previewTemplate, uploadMedia,
};
