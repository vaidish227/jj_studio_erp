const Joi = require("joi");
const { TASK_TYPES, PRIORITIES } = require("./Planner.validator");

const OID = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).message("Invalid object id");
const OID_OPT = OID.allow("", null);

// ---- Subtasks ------------------------------------------------------------

// Create a subtask under a parent task. taskType defaults from the parent in
// the controller when omitted.
const createSubtaskSchema = Joi.object({
  title:        Joi.string().trim().min(1).max(200).required(),
  taskType:     Joi.string().valid(...TASK_TYPES),
  assignedTo:   OID_OPT,
  priority:     Joi.string().valid(...PRIORITIES).default("medium"),
  notes:        Joi.string().allow("").max(2000),
  durationDays: Joi.number().integer().min(0).max(365),
  subtaskOrder: Joi.number().integer().min(0),
  dependsOn:    Joi.array().items(OID).max(50),
  plannedStartDate: Joi.date().allow(null),
  plannedEndDate:   Joi.date().allow(null),
}).custom((value, helpers) => {
  if (value.plannedStartDate && value.plannedEndDate
      && new Date(value.plannedEndDate) < new Date(value.plannedStartDate)) {
    return helpers.error("any.invalid", { message: "Planned end cannot be before planned start" });
  }
  return value;
}, "planned date order");

// Update a subtask's safe fields / ordering / planning. Status is NOT here —
// status transitions go through the normal Task controller.
const updateSubtaskSchema = Joi.object({
  title:        Joi.string().trim().min(1).max(200),
  assignedTo:   OID_OPT,
  priority:     Joi.string().valid(...PRIORITIES),
  notes:        Joi.string().allow("").max(2000),
  durationDays: Joi.number().integer().min(0).max(365),
  subtaskOrder: Joi.number().integer().min(0),
  dependsOn:    Joi.array().items(OID).max(50),
  scheduleLocked: Joi.boolean(),
  plannedStartDate: Joi.date().allow(null),
  plannedEndDate:   Joi.date().allow(null),
}).min(1);

// ---- Manual shift --------------------------------------------------------

// Either send an explicit signed `shiftDays`, OR a new date/duration the
// engine converts to a signed delta vs the task's current planned dates.
// `reason` is required so the audit trail is meaningful.
const manualShiftSchema = Joi.object({
  shiftDays:        Joi.number().integer().min(-365).max(365),
  plannedStartDate: Joi.date(),
  plannedEndDate:   Joi.date(),
  durationDays:     Joi.number().integer().min(0).max(365),
  reason:           Joi.string().trim().min(1).max(500).required(),
  cascade:          Joi.boolean().default(true),
}).or("shiftDays", "plannedStartDate", "plannedEndDate", "durationDays");

// ---- Recalculate ---------------------------------------------------------

const recalcSchema = Joi.object({
  overwriteExisting:   Joi.boolean().default(true),
  defaultDurationDays: Joi.number().integer().min(0).max(365).default(3),
  reason:              Joi.string().allow("").max(500),
});

// ---- Bulk patch (lock/unlock, etc.) -------------------------------------

const bulkSchedulePatchSchema = Joi.object({
  taskIds: Joi.array().items(OID).min(1).max(500).required(),
  patch: Joi.object({
    scheduleLocked:   Joi.boolean(),
    autoShiftEnabled: Joi.boolean().allow(null),
    priority:         Joi.string().valid(...PRIORITIES),
  }).min(1).required(),
});

module.exports = {
  createSubtaskSchema,
  updateSubtaskSchema,
  manualShiftSchema,
  recalcSchema,
  bulkSchedulePatchSchema,
};
