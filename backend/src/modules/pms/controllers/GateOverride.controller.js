/**
 * GateOverride.controller — Phase 1 stabilisation
 *
 * Two endpoints:
 *   - overrideGate(req,res)      → POST /api/pms/project/:id/gates/:gateId/override
 *     PM bypass of a single gate. Required by Phase 1 spec.
 *   - overrideTaskBlockers(req,res) → POST /api/pms/task/:id/override
 *     Convenience: override every gate currently blocking a single task and flip
 *     task.status from "blocked" → "not_started". Used by the BlockedByChip UI.
 *
 * Both endpoints require:
 *   - `tasks.override_gate` permission (enforced via routes)
 *   - `overrideReason` body field (validated here, min 5 chars)
 *
 * Activity log + notifications are emitted by workflowEngine.overrideGate.
 */

const mongoose = require("mongoose");
const Task = require("../models/Task.model");
const ApprovalGate = require("../models/ApprovalGate.model");
const workflowEngine = require("../services/workflowEngine");
const { gateOverrideSchema } = require("../validator/Task.validator");

/**
 * @route POST /api/pms/project/:id/gates/:gateId/override
 */
const overrideGate = async (req, res) => {
  try {
    const { id: projectId, gateId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: "Invalid project id" });
    }
    if (!mongoose.Types.ObjectId.isValid(gateId)) {
      return res.status(400).json({ message: "Invalid gate id" });
    }

    const { error, value } = gateOverrideSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        message: error.details.map((d) => d.message).join("; "),
      });
    }

    const gate = await ApprovalGate.findById(gateId);
    if (!gate) {
      return res.status(404).json({ message: "Approval gate not found" });
    }
    if (String(gate.projectId) !== String(projectId)) {
      return res.status(400).json({ message: "Gate does not belong to this project" });
    }

    if (gate.status !== "open") {
      return res.status(409).json({
        message: `Gate is already ${gate.status} and cannot be overridden`,
        gate,
      });
    }

    const result = await workflowEngine.overrideGate(gate._id, {
      actorId: req.user._id,
      overrideReason: value.overrideReason,
    });

    await workflowEngine.recomputeProjectPhase(projectId);

    const updated = await ApprovalGate.findById(gateId).lean();
    res.status(200).json({
      message: "Gate overridden",
      gate: updated,
      tasksUnblocked: result.tasksUnblocked,
    });
  } catch (err) {
    console.error("[overrideGate]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route POST /api/pms/task/:id/override
 * Convenience: override every gate currently blocking the task.
 * Returns the updated task plus a summary of gates overridden.
 */
const overrideTaskBlockers = async (req, res) => {
  try {
    const { id: taskId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ message: "Invalid task id" });
    }

    const { error, value } = gateOverrideSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        message: error.details.map((d) => d.message).join("; "),
      });
    }

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const access = await workflowEngine.evaluateTaskAccess(taskId);

    if (access.canStart && task.status !== "blocked") {
      return res.status(200).json({
        message: "Task is not blocked — nothing to override",
        task,
        gatesOverridden: [],
      });
    }

    const gatesOverridden = [];
    for (const gate of access.openGates) {
      const result = await workflowEngine.overrideGate(gate._id, {
        actorId: req.user._id,
        overrideReason: value.overrideReason,
      });
      gatesOverridden.push({
        gateId: gate._id,
        gateType: gate.gateType,
        label: gate.label,
        tasksUnblocked: result.tasksUnblocked,
      });
    }

    // If the task was blocked due solely to dependencies (no open gates), flip
    // it directly so the override is still useful. Reason is captured on the
    // most recent override gate, or in activity log otherwise.
    if (task.status === "blocked") {
      await Task.findByIdAndUpdate(taskId, {
        status: "not_started",
        gateStatus: "overridden",
      });
    }

    await workflowEngine.recomputeProjectPhase(task.projectId);

    const updated = await Task.findById(taskId)
      .populate("assignedTo", "name email")
      .lean();

    res.status(200).json({
      message: "Task unblocked via override",
      task: updated,
      gatesOverridden,
    });
  } catch (err) {
    console.error("[overrideTaskBlockers]", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  overrideGate,
  overrideTaskBlockers,
};
