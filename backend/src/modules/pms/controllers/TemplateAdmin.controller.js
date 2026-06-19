/**
 * TemplateAdmin.controller — Phase 3b + Phase 4 (workflow edit).
 *
 * ChecklistTemplate CRUD + WorkflowTemplate CRUD.
 *
 * Permissions:
 *   - settings.checklists.manage  → checklist CRUD
 *   - settings.workflows.manage   → workflow CRUD
 *
 * Snapshot semantics preserved: editing a template does NOT retroactively change
 * existing tasks/projects. Only NEW projects use the updated template.
 *
 * Safe-edit boundary for WorkflowTemplate (Phase 4 / Clone-and-Edit mode):
 *   Editable: template name, description, projectType, isDefault, isActive,
 *             task title / dayOffsetFromProjectStart / priority /
 *             responsibilitySlug / notes, gate label.
 *   Protected: task.key, task.taskType, gate.key, gate.gateType, gate.approverType,
 *              gate.listensTo, gate.blockedActivities, gate.unblocks,
 *              phase.name/order, dependsOnKeys, requiresGateKeys.
 *
 *   Why: protected fields are hard-referenced in workflowEngine.js,
 *        gateEnforcement.js, and frontend status logic. Editing them via the
 *        editor would silently break gating / dependency resolution on new
 *        projects. Phase 5 may unlock these behind a graph-editor UI with
 *        validation.
 */

const Joi = require("joi");
const ChecklistTemplate = require("../models/ChecklistTemplate.model");
const WorkflowTemplate = require("../models/WorkflowTemplate.model");
const Responsibility = require("../models/Responsibility.model");
const Task = require("../models/Task.model");

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

// ── WorkflowTemplate CRUD (Phase 4 — Clone & Edit) ──────────────────────────

const PRIORITY_VALUES = ["low", "medium", "high", "urgent"];
const PROJECT_TYPES   = ["Residential", "Commercial", "Any"];

// Engine-known phase slugs (lowercased) — auto-advance only works for these.
// Renaming a phase to something not in this list disables auto-advance for it.
const SYSTEM_PHASE_SLUGS = [
  "kickoff", "layout", "design", "procurement", "release", "execution", "handover",
];

// Friendly labels for taskType enum — drives dropdown display.
const TASK_TYPE_LABELS = {
  ac_coordination:           "AC Coordination",
  technical_drawing:         "Technical Drawing",
  kitchen_drawing:           "Kitchen Drawing",
  bathroom_drawing:          "Bathroom Drawing",
  automation_coordination:   "Automation Coordination",
  "3d_render":               "3D Render",
  concept_making:            "Concept Making",
  furniture_layout:          "Furniture Layout",
  site_measurement:          "Site Measurement",
  civil_drawing:             "Civil Drawing",
  mep_collection:            "MEP Collection",
  concept_first_meeting:     "Concept — First Meeting",
  concept_feedback_meeting:  "Concept — Feedback Meeting",
  handover_signoff:          "Handover Sign-off",
  kitchen_detail_elevation:  "Kitchen — Detail Elevation",
  kitchen_3d:                "Kitchen — 3D",
  kitchen_technical_drawings:"Kitchen — Technical Drawings",
  kitchen_release_ready:     "Kitchen — Release Ready",
  kitchen_vendor_purchase:   "Kitchen — Vendor Purchase",
  kitchen_tentative_quote:   "Kitchen — Tentative Quote",
  kitchen_client_meeting:    "Kitchen — Client Meeting",
  kitchen_vendor_finalization: "Kitchen — Vendor Finalization",
};

/**
 * Extract the taskType enum directly from the Mongoose schema so the dropdown
 * stays in lock-step with backend-allowed values. Single source of truth.
 */
const getTaskTypeEnum = () => {
  const path = Task.schema.path("taskType");
  return path?.enumValues || [];
};

/**
 * @route GET /api/pms/templates/workflow/options
 * Returns all backend-mapped dropdown options needed by the editor:
 *   taskTypes, responsibilities, checklistTemplates, priorities,
 *   projectTypes, approverTypes, knownPhaseSlugs.
 *
 * Single round-trip on editor open keeps the UI snappy.
 */
const getWorkflowTemplateOptions = async (_req, res) => {
  try {
    const [responsibilities, checklists] = await Promise.all([
      Responsibility.find({ isActive: { $ne: false } })
        .select("slug name category icon")
        .sort({ order: 1, name: 1 })
        .lean(),
      ChecklistTemplate.find({ isActive: true })
        .select("name taskType isDefault")
        .sort({ taskType: 1, isDefault: -1, name: 1 })
        .lean(),
    ]);

    const taskTypes = getTaskTypeEnum().map((value) => ({
      value,
      label: TASK_TYPE_LABELS[value] || value,
    }));

    res.json({
      taskTypes,
      responsibilities: responsibilities.map((r) => ({
        slug: r.slug, name: r.name, category: r.category, icon: r.icon,
      })),
      checklistTemplates: checklists.map((c) => ({
        name: c.name, taskType: c.taskType, isDefault: c.isDefault,
      })),
      priorities:   PRIORITY_VALUES.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) })),
      projectTypes: PROJECT_TYPES.map((t) => ({ value: t, label: t })),
      approverTypes: [
        { value: "client",                label: "Client" },
        { value: "manager",               label: "Manager" },
        { value: "principal_designer",    label: "Principal Designer" },
        { value: "principal_and_client",  label: "Principal Designer + Client" },
      ],
      knownPhaseSlugs: SYSTEM_PHASE_SLUGS,
    });
  } catch (err) {
    console.error("[getWorkflowTemplateOptions]", err);
    res.status(500).json({ message: err.message });
  }
};

// Edit body — only safe-to-edit fields. Anything else is silently dropped.
// `key` is now optional: if absent, the server generates one (task added in UI).
// `taskType` is editable on NEW tasks (existing tasks keep their stored value
// because changing it could break running engine logic; see updateWorkflowTemplate).
const taskEditSchema = Joi.object({
  key: Joi.string().trim().max(80).optional(),
  taskType: Joi.string().trim().required(),
  title: Joi.string().trim().min(1).max(200).required(),
  dayOffsetFromProjectStart: Joi.number().integer().min(0).max(730).required(),
  plannedDays:  Joi.number().min(0).max(730).default(1),
  plannedHours: Joi.number().min(0).max(10000).default(0),
  priority: Joi.string().valid(...PRIORITY_VALUES).required(),
  responsibilitySlug: Joi.string().trim().allow("").optional(),
  checklistTemplateName: Joi.string().trim().allow("").optional(),
  notes: Joi.string().allow("").max(500).optional(),
  // Subtask: key (or client draft id) of the parent task. Remapped + validated
  // server-side; references that don't survive the save are dropped.
  parentKey:    Joi.string().trim().allow("", null).optional(),
  subtaskOrder: Joi.number().integer().min(0).max(999).optional(),
});

const gateEditSchema = Joi.object({
  key: Joi.string().trim().required(),
  label: Joi.string().trim().min(1).max(200).required(),
});

// Phase edit: name editable, taskKeys/gateKeys reflect which tasks belong here.
const phaseEditSchema = Joi.object({
  name:     Joi.string().trim().min(1).max(80).required(),
  order:    Joi.number().integer().min(1).max(99).required(),
  taskKeys: Joi.array().items(Joi.string().trim()).default([]),
  gateKeys: Joi.array().items(Joi.string().trim()).default([]),
  // Phase day budget (milestone). Both optional.
  startDayOffset: Joi.number().integer().min(0).max(3650).optional(),
  dayBudget:      Joi.number().integer().min(0).max(3650).allow(null).optional(),
});

const updateWorkflowSchema = Joi.object({
  name:        Joi.string().trim().min(1).max(120).optional(),
  description: Joi.string().allow("").max(500).optional(),
  projectType: Joi.string().valid(...PROJECT_TYPES).optional(),
  isDefault:   Joi.boolean().optional(),
  isActive:    Joi.boolean().optional(),
  phases:      Joi.array().items(phaseEditSchema).optional(),
  tasks:       Joi.array().items(taskEditSchema).optional(),
  gates:       Joi.array().items(gateEditSchema).optional(),
}).min(1);

/**
 * Generate a stable task key from title + day offset + suffix.
 * Used when the editor adds a new task with no pre-existing key.
 */
const generateTaskKey = (title, dayOffset, existingKeys) => {
  const base = String(title || "task")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "task";
  let candidate = `${base}_d${dayOffset || 0}`;
  if (!existingKeys.has(candidate)) return candidate;
  let n = 2;
  while (existingKeys.has(`${candidate}_${n}`)) n += 1;
  return `${candidate}_${n}`;
};

// Clone body: which template to clone, plus new name + optional overrides.
// "blank" is also supported when sourceId is not provided.
const createWorkflowSchema = Joi.object({
  sourceId:    Joi.string().hex().length(24).optional(),
  name:        Joi.string().trim().min(1).max(120).required(),
  description: Joi.string().allow("").max(500).optional(),
  projectType: Joi.string().valid(...PROJECT_TYPES).optional(),
});

/**
 * @route PATCH /api/pms/templates/workflow/:id
 * Updates editable fields on a workflow template. Protected fields
 * (task.key, task.taskType, gate.key/gateType/approverType, phase structure,
 * dependsOnKeys, requiresGateKeys) are preserved from the existing document.
 */
const updateWorkflowTemplate = async (req, res) => {
  try {
    const { error, value } = updateWorkflowSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });

    const template = await WorkflowTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ message: "Template not found" });

    // Name uniqueness check (excluding self)
    if (value.name && value.name !== template.name) {
      const dup = await WorkflowTemplate.findOne({ name: value.name, _id: { $ne: template._id } }).lean();
      if (dup) return res.status(409).json({ message: `A template named "${value.name}" already exists` });
    }

    // If isDefault flips to true, unset other defaults sharing the same projectType
    const willBeDefault = value.isDefault === true;
    const willBeType    = value.projectType || template.projectType;
    if (willBeDefault && (!template.isDefault || value.projectType !== template.projectType)) {
      await WorkflowTemplate.updateMany(
        { projectType: willBeType, isDefault: true, _id: { $ne: template._id } },
        { $set: { isDefault: false } }
      );
    }

    // Apply scalar fields
    if (value.name !== undefined)        template.name        = value.name;
    if (value.description !== undefined) template.description = value.description;
    if (value.projectType !== undefined) template.projectType = value.projectType;
    if (value.isDefault !== undefined)   template.isDefault   = value.isDefault;
    if (value.isActive !== undefined)    template.isActive    = value.isActive;

    // ── Tasks: full diff. The payload is the COMPLETE desired task list.
    //   - Tasks with an existing `key` are merged (preserve dependsOnKeys,
    //     requiresGateKeys, teamSlot, taskType).
    //   - Tasks without `key` are NEW: server generates key, taskType comes
    //     from the request.
    //   - Tasks missing from the payload but present in the doc are REMOVED.
    // submittedKeyToFinalKey lets the phases payload reference newly-added
    // tasks via their client-side draft id — server rewrites those to the
    // freshly minted stable key when applying phase.taskKeys below.
    const submittedKeyToFinalKey = new Map();
    if (Array.isArray(value.tasks)) {
      const validTaskTypes = new Set(getTaskTypeEnum());
      const existingByKey  = new Map((template.tasks || []).map((t) => [
        t.key,
        t.toObject ? t.toObject() : t,
      ]));
      const usedKeys       = new Set();
      const nextTasks      = [];

      for (const edit of value.tasks) {
        if (!validTaskTypes.has(edit.taskType)) {
          return res.status(400).json({
            message: `Unknown taskType "${edit.taskType}". Pick one from the dropdown.`,
          });
        }

        // Existing → merge protected fields onto the edit
        if (edit.key && existingByKey.has(edit.key)) {
          const existing = existingByKey.get(edit.key);
          // taskType on existing rows stays put — switching it on an in-flight
          // template could surprise the engine. New rows can freely set it.
          usedKeys.add(edit.key);
          submittedKeyToFinalKey.set(edit.key, edit.key);
          nextTasks.push({
            ...existing,
            title: edit.title,
            dayOffsetFromProjectStart: edit.dayOffsetFromProjectStart,
            plannedDays:  edit.plannedDays  ?? existing.plannedDays  ?? 1,
            plannedHours: edit.plannedHours ?? existing.plannedHours ?? 0,
            priority: edit.priority,
            responsibilitySlug:    edit.responsibilitySlug    ?? existing.responsibilitySlug,
            checklistTemplateName: edit.checklistTemplateName ?? existing.checklistTemplateName,
            notes:                 edit.notes                 ?? existing.notes,
            // Raw parentKey carried here; remapped/validated in the sweep below.
            parentKey:    edit.parentKey !== undefined ? (edit.parentKey || null) : (existing.parentKey || null),
            subtaskOrder: edit.subtaskOrder ?? existing.subtaskOrder ?? 0,
          });
          continue;
        }

        // New task — generate key, accept submitted taskType
        const newKey = generateTaskKey(edit.title, edit.dayOffsetFromProjectStart, usedKeys);
        usedKeys.add(newKey);
        // Remember the submitted (draft) key so phase.taskKeys can be rewritten.
        if (edit.key) submittedKeyToFinalKey.set(edit.key, newKey);
        nextTasks.push({
          key: newKey,
          taskType:                  edit.taskType,
          title:                     edit.title,
          dayOffsetFromProjectStart: edit.dayOffsetFromProjectStart,
          plannedDays:               edit.plannedDays  ?? 1,
          plannedHours:              edit.plannedHours ?? 0,
          priority:                  edit.priority,
          responsibilitySlug:        edit.responsibilitySlug    || "",
          checklistTemplateName:     edit.checklistTemplateName || "",
          notes:                     edit.notes                 || "",
          dependsOnKeys:             [],
          requiresGateKeys:          [],
          parentKey:                 edit.parentKey || null,
          subtaskOrder:              edit.subtaskOrder || 0,
        });
      }

      // Sweep dependsOnKeys / requiresGateKeys on surviving tasks — drop refs
      // to removed task keys / gate keys so we don't ship dangling references.
      const survivingKeys = usedKeys;

      // Resolve parentKey: remap client draft ids → final keys, then drop
      // dangling / self references.
      const finalParentOf = new Map();
      for (const t of nextTasks) {
        let pk = t.parentKey || null;
        if (pk) pk = submittedKeyToFinalKey.get(pk) || pk;
        if (pk && (!survivingKeys.has(pk) || pk === t.key)) pk = null;
        finalParentOf.set(t.key, pk);
      }

      template.tasks = nextTasks.map((t) => {
        // Keep subtasks one level deep: if this task's parent is itself a
        // subtask, flatten this task to top-level.
        let pk = finalParentOf.get(t.key);
        if (pk && finalParentOf.get(pk)) pk = null;
        return {
          ...t,
          parentKey:        pk,
          subtaskOrder:     Number(t.subtaskOrder) || 0,
          dependsOnKeys:    (t.dependsOnKeys || []).filter((k) => survivingKeys.has(k)),
          // gate sweep happens after we decide gate diff below
          requiresGateKeys: t.requiresGateKeys || [],
        };
      });
    }

    // ── Gates: label-only edits, no add/remove via this endpoint yet.
    //   Gates are engine-bound (gateType + blockedActivities + listensTo) and
    //   adding/removing them requires the workflow engine to recognise them.
    //   Phase 5 unlock if needed.
    if (Array.isArray(value.gates)) {
      const byKey = new Map(value.gates.map((g) => [g.key, g]));
      template.gates = (template.gates || []).map((existing) => {
        const exObj = existing.toObject ? existing.toObject() : existing;
        const edit  = byKey.get(exObj.key);
        if (!edit) return exObj;
        return { ...exObj, label: edit.label };
      });
    }

    // ── Phases: rename + reorder + retagged task/gate keys.
    //   Engine-known phase slugs (kickoff/layout/.../handover) drive auto-
    //   advance. Renaming them disables auto-advance for that phase but
    //   tasks still fire on day offsets. Editor warns the user.
    if (Array.isArray(value.phases)) {
      const survivingTaskKeys = new Set((template.tasks || []).map((t) => t.key));
      const survivingGateKeys = new Set((template.gates || []).map((g) => g.key));

      // Rewrite client-side draft task keys into the freshly minted server
      // keys before filtering — otherwise newly-added tasks become orphans.
      const remapTaskKey = (k) => submittedKeyToFinalKey.get(k) ?? k;

      // Phase names must be unique (case-insensitive). The editor lets users
      // add phases freely, so we guard here.
      const seenPhaseNames = new Set();
      for (const p of value.phases) {
        const lower = String(p.name || '').trim().toLowerCase();
        if (!lower) return res.status(400).json({ message: "Phase name cannot be empty" });
        if (seenPhaseNames.has(lower)) {
          return res.status(400).json({ message: `Duplicate phase name "${p.name}"` });
        }
        seenPhaseNames.add(lower);
      }

      // Re-number orders contiguously from 1 so the editor never ships odd gaps.
      template.phases = value.phases
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((p, idx) => ({
          name:     String(p.name).trim(),
          order:    idx + 1,
          taskKeys: (p.taskKeys || []).map(remapTaskKey).filter((k) => survivingTaskKeys.has(k)),
          gateKeys: (p.gateKeys || []).filter((k) => survivingGateKeys.has(k)),
          startDayOffset: Number(p.startDayOffset) || 0,
          dayBudget:      p.dayBudget != null ? Number(p.dayBudget) : null,
        }));
    }

    await template.save();
    res.json({ message: "Template updated", template: template.toObject() });
  } catch (err) {
    console.error("[updateWorkflowTemplate]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route POST /api/pms/templates/workflow
 * Creates a new workflow template either by cloning an existing one
 * (`sourceId` present) or as a minimal blank stub.
 * Cloned templates are never created as default — user explicitly promotes.
 */
const createWorkflowTemplate = async (req, res) => {
  try {
    const { error, value } = createWorkflowSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });

    const dup = await WorkflowTemplate.findOne({ name: value.name }).lean();
    if (dup) return res.status(409).json({ message: `A template named "${value.name}" already exists` });

    let payload;
    if (value.sourceId) {
      const source = await WorkflowTemplate.findById(value.sourceId).lean();
      if (!source) return res.status(404).json({ message: "Source template not found" });

      payload = {
        name:        value.name,
        description: value.description !== undefined ? value.description : source.description,
        projectType: value.projectType || source.projectType,
        isDefault:   false,                                     // never inherit default flag
        isActive:    true,
        phases:      source.phases,
        tasks:       source.tasks,
        gates:       source.gates,
        createdBy:   req.user?._id,
      };
    } else {
      payload = {
        name:        value.name,
        description: value.description || "",
        projectType: value.projectType || "Any",
        isDefault:   false,
        isActive:    true,
        phases:      [{ name: "kickoff", order: 1, taskKeys: [], gateKeys: [] }],
        tasks:       [],
        gates:       [],
        createdBy:   req.user?._id,
      };
    }

    const template = await WorkflowTemplate.create(payload);
    res.status(201).json({ message: "Template created", template });
  } catch (err) {
    console.error("[createWorkflowTemplate]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route DELETE /api/pms/templates/workflow/:id
 * Refuses to delete a template flagged `isDefault` — caller must promote
 * another template to default first. Existing projects are NOT touched.
 */
const deleteWorkflowTemplate = async (req, res) => {
  try {
    const t = await WorkflowTemplate.findById(req.params.id);
    if (!t) return res.status(404).json({ message: "Template not found" });
    if (t.isDefault) {
      return res.status(409).json({
        message: "Cannot delete the default template. Promote another template to default first.",
      });
    }
    await t.deleteOne();
    res.json({ message: "Template deleted" });
  } catch (err) {
    console.error("[deleteWorkflowTemplate]", err);
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
  getWorkflowTemplateOptions,
  updateWorkflowTemplate,
  createWorkflowTemplate,
  deleteWorkflowTemplate,
};
