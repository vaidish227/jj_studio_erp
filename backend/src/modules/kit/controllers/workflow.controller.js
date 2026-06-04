const KitWorkflow = require("../models/KitWorkflow.model");
const KitTriggerEvent = require("../models/KitTriggerEvent.model");
const { createWorkflowSchema, updateWorkflowSchema } = require("../validators/workflow.validator");
const { TRIGGERS, isValidEvent } = require("../constants/triggerCatalog");

const badRequest = (res, error) =>
  res.status(400).json({ message: error.details.map((d) => d.message).join(", ") });

// ─── Trigger catalog (for the Automation Builder dropdowns) ───────────────────
const getTriggerCatalog = async (_req, res) => {
  res.status(200).json({ message: "Trigger catalog", data: { triggers: TRIGGERS } });
};

// ─── Workflow CRUD ────────────────────────────────────────────────────────────
const createWorkflow = async (req, res) => {
  try {
    const { error, value } = createWorkflowSchema.validate(req.body);
    if (error) return badRequest(res, error);
    if (!isValidEvent(value.trigger.event)) return res.status(400).json({ message: `Unknown trigger event: ${value.trigger.event}` });

    const workflow = await KitWorkflow.create({ ...value, createdBy: req.user._id });
    res.status(201).json({ message: "Workflow created", data: workflow });
  } catch (err) {
    console.error("[kit.createWorkflow]", err);
    res.status(500).json({ message: err.message });
  }
};

const getWorkflows = async (req, res) => {
  try {
    const { isActive, event } = req.query;
    const query = {};
    if (isActive !== undefined) query.isActive = isActive === "true";
    if (event) query["trigger.event"] = event;

    const workflows = await KitWorkflow.find(query).sort({ updatedAt: -1 }).lean();

    // Attach a recent fire count per workflow for the list view.
    const ids = workflows.map((w) => w._id);
    const fireCounts = await KitTriggerEvent.aggregate([
      { $match: { matchedWorkflows: { $in: ids } } },
      { $unwind: "$matchedWorkflows" },
      { $match: { matchedWorkflows: { $in: ids } } },
      { $group: { _id: "$matchedWorkflows", n: { $sum: 1 } } },
    ]);
    const fireMap = Object.fromEntries(fireCounts.map((f) => [String(f._id), f.n]));
    const data = workflows.map((w) => ({ ...w, fireCount: fireMap[String(w._id)] || 0 }));

    res.status(200).json({ message: "Workflows fetched", data });
  } catch (err) {
    console.error("[kit.getWorkflows]", err);
    res.status(500).json({ message: err.message });
  }
};

const getWorkflowById = async (req, res) => {
  try {
    const workflow = await KitWorkflow.findById(req.params.id)
      .populate("actions.campaignId", "name")
      .populate("actions.templateId", "name channel")
      .lean();
    if (!workflow) return res.status(404).json({ message: "Workflow not found" });
    res.status(200).json({ message: "Workflow fetched", data: workflow });
  } catch (err) {
    console.error("[kit.getWorkflowById]", err);
    res.status(500).json({ message: err.message });
  }
};

const updateWorkflow = async (req, res) => {
  try {
    const { error, value } = updateWorkflowSchema.validate(req.body);
    if (error) return badRequest(res, error);
    if (value.trigger && !isValidEvent(value.trigger.event)) {
      return res.status(400).json({ message: `Unknown trigger event: ${value.trigger.event}` });
    }
    const workflow = await KitWorkflow.findByIdAndUpdate(req.params.id, { $set: value }, { new: true, runValidators: true });
    if (!workflow) return res.status(404).json({ message: "Workflow not found" });
    res.status(200).json({ message: "Workflow updated", data: workflow });
  } catch (err) {
    console.error("[kit.updateWorkflow]", err);
    res.status(500).json({ message: err.message });
  }
};

const toggleWorkflow = async (req, res) => {
  try {
    const workflow = await KitWorkflow.findById(req.params.id);
    if (!workflow) return res.status(404).json({ message: "Workflow not found" });

    // Guard: don't activate an incomplete workflow.
    if (!workflow.isActive) {
      if (!workflow.actions?.length) return res.status(400).json({ message: "Add at least one action before activating" });
      if (!workflow.trigger?.event) return res.status(400).json({ message: "Set a trigger before activating" });
    }

    workflow.isActive = !workflow.isActive;
    await workflow.save();
    res.status(200).json({ message: workflow.isActive ? "Workflow activated" : "Workflow paused", data: workflow });
  } catch (err) {
    console.error("[kit.toggleWorkflow]", err);
    res.status(500).json({ message: err.message });
  }
};

const deleteWorkflow = async (req, res) => {
  try {
    const workflow = await KitWorkflow.findByIdAndDelete(req.params.id);
    if (!workflow) return res.status(404).json({ message: "Workflow not found" });
    res.status(200).json({ message: "Workflow deleted" });
  } catch (err) {
    console.error("[kit.deleteWorkflow]", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getTriggerCatalog,
  createWorkflow, getWorkflows, getWorkflowById, updateWorkflow, toggleWorkflow, deleteWorkflow,
};
