const Joi = require("joi");

const OID = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).message("Invalid object id");
const OID_OPT = OID.allow("", null);

// Mirror of Task.taskType enum — keep in sync with Task.model.js
const TASK_TYPES = [
  "ac_coordination", "technical_drawing", "kitchen_drawing", "bathroom_drawing",
  "automation_coordination", "3d_render", "concept_making", "furniture_layout",
  "site_measurement", "civil_drawing",
  "mep_collection", "concept_first_meeting", "concept_feedback_meeting", "handover_signoff",
  "kitchen_detail_elevation", "kitchen_3d", "kitchen_technical_drawings", "kitchen_release_ready",
  "kitchen_vendor_purchase", "kitchen_tentative_quote", "kitchen_client_meeting", "kitchen_vendor_finalization",
];

const PRIORITIES = ["low", "medium", "high", "urgent"];
const COMPLEXITIES = ["low", "medium", "high"];
const SITE_MEASUREMENT = ["not_required", "pending", "done"];

const planningPatch = Joi.object({
  floor:    Joi.string().allow("").max(60),
  area:     Joi.string().allow("").max(120),
  zoneName: Joi.string().allow("").max(120),
  room:     Joi.string().allow("").max(120),
  block:    Joi.string().allow("").max(60),

  proposedDrawingType: Joi.string().allow("").max(60),
  proposedSubCategory: Joi.string().allow("").max(120),
  drawingCode:         Joi.string().allow("").max(120),

  plannedStartDate:     Joi.date().allow(null),
  plannedEndDate:       Joi.date().allow(null),
  plannedHours:         Joi.number().min(0).max(10000),
  bufferDays:           Joi.number().integer().min(0).max(365),
  targetSubmissionDate: Joi.date().allow(null),

  actualHours:     Joi.number().min(0).max(10000),
  progressPercent: Joi.number().min(0).max(100),

  complexity:            Joi.string().valid(...COMPLEXITIES),
  requiredInputs:        Joi.array().items(Joi.string().max(120)).max(20),
  siteMeasurementStatus: Joi.string().valid(...SITE_MEASUREMENT),

  designLeadId:  OID_OPT,
  reviewerId:    OID_OPT,
  coordinatorId: OID_OPT,

  requiresClientApproval: Joi.boolean(),
  clientApprovalKey:      Joi.string().allow("").max(60),

  referenceFileUrl: Joi.string().uri().allow(""),
}).custom((value, helpers) => {
  if (value.plannedStartDate && value.plannedEndDate
      && new Date(value.plannedEndDate) < new Date(value.plannedStartDate)) {
    return helpers.error("any.invalid", { message: "Planned end date cannot be before planned start date" });
  }
  return value;
}, "planned date order");

const createRowSchema = Joi.object({
  title:    Joi.string().trim().min(1).max(200).required(),
  taskType: Joi.string().valid(...TASK_TYPES).default("technical_drawing"),
  assignedTo: OID_OPT,
  priority: Joi.string().valid(...PRIORITIES).default("medium"),
  notes:    Joi.string().allow("").max(2000),
  dependsOn: Joi.array().items(OID).max(50),
  // Optional phase label so the master-sheet UI can drop the new row under the
  // correct phase header. Free-form to match the template's phase names.
  phase:    Joi.string().trim().allow("").max(80),
  planning:  planningPatch.default({}),
});

const patchRowSchema = Joi.object({
  title:      Joi.string().trim().min(1).max(200),
  taskType:   Joi.string().valid(...TASK_TYPES),
  assignedTo: OID_OPT,
  priority:   Joi.string().valid(...PRIORITIES),
  notes:      Joi.string().allow("").max(2000),
  delayReason: Joi.string().allow("").max(500),
  dependsOn:  Joi.array().items(OID).max(50),
  planning:   planningPatch,
  // Optimistic concurrency
  updatedAt:  Joi.date(),
}).min(1);

const bulkPatchSchema = Joi.object({
  taskIds: Joi.array().items(OID).min(1).max(500).required(),
  patch:   patchRowSchema.required(),
});

const bulkAssignSchema = Joi.object({
  taskIds:    Joi.array().items(OID).min(1).max(500).required(),
  assignedTo: OID.required(),
});

const bulkDatesSchema = Joi.object({
  taskIds:    Joi.array().items(OID).min(1).max(500).required(),
  mode:       Joi.string().valid("shift", "set").required(),
  shiftDays:  Joi.number().integer().when("mode", { is: "shift", then: Joi.required() }),
  plannedStartDate: Joi.date().when("mode", { is: "set", then: Joi.required() }),
  plannedEndDate:   Joi.date().when("mode", { is: "set", then: Joi.required() }),
});

const masterQuerySchema = Joi.object({
  floor:        Joi.string().allow(""),
  zone:         Joi.string().allow(""),
  designer:     OID_OPT,
  category:     Joi.string().allow(""),
  stage:        Joi.string().allow(""),
  status:       Joi.string().allow(""),
  priority:     Joi.string().valid(...PRIORITIES, ""),
  delayedOnly:  Joi.boolean().truthy("true").falsy("false"),
  search:       Joi.string().allow("").max(120),
}).unknown(true);

module.exports = {
  TASK_TYPES,
  PRIORITIES,
  createRowSchema,
  patchRowSchema,
  bulkPatchSchema,
  bulkAssignSchema,
  bulkDatesSchema,
  masterQuerySchema,
};
