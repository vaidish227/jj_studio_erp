/**
 * TemplateAdmin.controller — Phase 3b.
 *
 * ChecklistTemplate CRUD + WorkflowTemplate read-only viewer.
 *
 * Permissions:
 *   - settings.checklists.manage  → checklist CRUD
 *   - settings.workflows.manage   → workflow read-only (writes deferred to Phase 4)
 *
 * Snapshot semantics preserved: editing a template does NOT retroactively change
 * existing tasks. Only new tasks get the updated items.
 */

const Joi = require("joi");
const ChecklistTemplate = require("../models/ChecklistTemplate.model");
const WorkflowTemplate = require("../models/WorkflowTemplate.model");

const itemSchema = Joi.object({
  label: Joi.string().trim().min(1).required(),
  order: Joi.number().integer().min(0).optional(),
});

const createChecklistSchema = Joi.object({
  name:        Joi.string().trim().min(1).required(),
  taskType:    Joi.string().trim().min(1).required(),
  description: Joi.string().allow("").optional(),
  items:       Joi.array().items(itemSchema).min(1).required(),
  isDefault:   Joi.boolean().optional(),
  isActive:    Joi.boolean().optional(),
});

const updateChecklistSchema = Joi.object({
  description: Joi.string().allow("").optional(),
  items:       Joi.array().items(itemSchema).optional(),
  isDefault:   Joi.boolean().optional(),
  isActive:    Joi.boolean().optional(),
}).min(1);

// ── ChecklistTemplate CRUD ──────────────────────────────────────────────────

/**
 * @route GET /api/pms/templates/checklist
 */
const listChecklistTemplates = async (req, res) => {
  try {
    const { taskType, search, isActive } = req.query;
    const q = {};
    if (taskType) q.taskType = taskType;
    if (isActive !== undefined) q.isActive = isActive === "true";
    if (search) q.name = { $regex: search, $options: "i" };
    const templates = await ChecklistTemplate.find(q)
      .populate("createdBy", "name")
      .sort({ taskType: 1, isDefault: -1, name: 1 })
      .lean();
    res.json({ count: templates.length, templates });
  } catch (err) {
    console.error("[listChecklistTemplates]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route GET /api/pms/templates/checklist/:id
 */
const getChecklistTemplate = async (req, res) => {
  try {
    const t = await ChecklistTemplate.findById(req.params.id).populate("createdBy", "name").lean();
    if (!t) return res.status(404).json({ message: "Template not found" });
    res.json({ template: t });
  } catch (err) {
    console.error("[getChecklistTemplate]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route POST /api/pms/templates/checklist
 */
const createChecklistTemplate = async (req, res) => {
  try {
    const { error, value } = createChecklistSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });

    const dup = await ChecklistTemplate.findOne({ name: value.name }).lean();
    if (dup) return res.status(409).json({ message: `Template "${value.name}" already exists` });

    // If isDefault=true, unset isDefault on any existing default for this taskType
    if (value.isDefault) {
      await ChecklistTemplate.updateMany(
        { taskType: value.taskType, isDefault: true },
        { $set: { isDefault: false } }
      );
    }

    const template = await ChecklistTemplate.create({
      ...value,
      createdBy: req.user._id,
    });
    res.status(201).json({ message: "Template created", template });
  } catch (err) {
    console.error("[createChecklistTemplate]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route PATCH /api/pms/templates/checklist/:id
 */
const updateChecklistTemplate = async (req, res) => {
  try {
    const { error, value } = updateChecklistSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });

    const template = await ChecklistTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ message: "Template not found" });

    // Defaulting toggle — keep only one default per taskType
    if (value.isDefault === true && !template.isDefault) {
      await ChecklistTemplate.updateMany(
        { taskType: template.taskType, isDefault: true, _id: { $ne: template._id } },
        { $set: { isDefault: false } }
      );
    }

    Object.assign(template, value);
    await template.save();
    res.json({ message: "Template updated", template });
  } catch (err) {
    console.error("[updateChecklistTemplate]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route DELETE /api/pms/templates/checklist/:id
 */
const deleteChecklistTemplate = async (req, res) => {
  try {
    const t = await ChecklistTemplate.findById(req.params.id);
    if (!t) return res.status(404).json({ message: "Template not found" });
    if (t.isDefault) {
      return res.status(409).json({ message: "Cannot delete the default template for this task type. Promote a different one to default first." });
    }
    await t.deleteOne();
    res.json({ message: "Template deleted" });
  } catch (err) {
    console.error("[deleteChecklistTemplate]", err);
    res.status(500).json({ message: err.message });
  }
};

// ── WorkflowTemplate read-only viewer ───────────────────────────────────────

/**
 * @route GET /api/pms/templates/workflow
 */
const listWorkflowTemplates = async (req, res) => {
  try {
    const templates = await WorkflowTemplate.find({})
      .populate("createdBy", "name")
      .select("name description projectType isDefault isActive phases tasks gates createdAt updatedAt")
      .sort({ isDefault: -1, name: 1 })
      .lean();
    // Add summary counts for the list view
    const enriched = templates.map((t) => ({
      ...t,
      taskCount: t.tasks?.length || 0,
      gateCount: t.gates?.length || 0,
      phaseCount: t.phases?.length || 0,
    }));
    res.json({ count: enriched.length, templates: enriched });
  } catch (err) {
    console.error("[listWorkflowTemplates]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route GET /api/pms/templates/workflow/:id
 */
const getWorkflowTemplate = async (req, res) => {
  try {
    const t = await WorkflowTemplate.findById(req.params.id)
      .populate("createdBy", "name")
      .lean();
    if (!t) return res.status(404).json({ message: "Template not found" });
    res.json({ template: t });
  } catch (err) {
    console.error("[getWorkflowTemplate]", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  listChecklistTemplates,
  getChecklistTemplate,
  createChecklistTemplate,
  updateChecklistTemplate,
  deleteChecklistTemplate,
  listWorkflowTemplates,
  getWorkflowTemplate,
};
