const Joi = require("joi");

// Reusable ObjectId validator.
const OID = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .messages({ "string.pattern.base": "must be a valid id" });

const STATUSES = [
  "created",
  "assigned",
  "in_progress",
  "review",
  "completed",
  "reopened",
  "cancelled",
];
const PRIORITIES = ["low", "medium", "high", "urgent"];

/**
 * Allowed status transitions for the simplified MVP workflow. Exported so the
 * Sprint 2 workflow service / status endpoint enforce a single source of truth.
 *   created → assigned → in_progress → review → completed
 *   completed → reopened → in_progress
 *   (almost) any state → cancelled
 */
const ALLOWED_TRANSITIONS = {
  created: ["assigned", "in_progress", "cancelled"],
  assigned: ["in_progress", "cancelled"],
  in_progress: ["review", "cancelled"],
  review: ["completed", "in_progress", "cancelled"],
  completed: ["reopened"],
  reopened: ["in_progress", "cancelled"],
  cancelled: [],
};

const checklistInput = Joi.object({
  item: Joi.string().trim().min(1).max(300).required(),
});

const createDelegationSchema = Joi.object({
  title: Joi.string().trim().min(3).max(160).required(),
  description: Joi.string().allow("").max(5000).optional(),
  // departmentId is OPTIONAL — system works with zero departments configured.
  departmentId: OID.optional(),
  projectId: OID.optional(),
  clientId: OID.optional(),
  assignedTo: OID.optional(),
  priority: Joi.string().valid(...PRIORITIES).optional(),
  dueDate: Joi.date().optional(),
  checklist: Joi.array().items(checklistInput).optional(),
});

const updateDelegationSchema = Joi.object({
  title: Joi.string().trim().min(3).max(160).optional(),
  description: Joi.string().allow("").max(5000).optional(),
  departmentId: OID.allow(null).optional(),
  projectId: OID.allow(null).optional(),
  clientId: OID.allow(null).optional(),
  priority: Joi.string().valid(...PRIORITIES).optional(),
  dueDate: Joi.date().allow(null).optional(),
})
  .min(1)
  .messages({ "object.min": "At least one field must be provided" });

const assignSchema = Joi.object({
  assignedTo: OID.required(),
  note: Joi.string().allow("").max(500).optional(),
});

const reassignSchema = Joi.object({
  assignedTo: OID.required(),
  reason: Joi.string().trim().min(3).max(500).required(),
});

const statusChangeSchema = Joi.object({
  status: Joi.string().valid(...STATUSES).required(),
  note: Joi.string().allow("").max(500).optional(),
});

const checklistSchema = Joi.object({
  op: Joi.string().valid("add", "toggle", "remove").required(),
  item: Joi.string().trim().min(1).max(300).when("op", {
    is: "add",
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  itemId: OID.when("op", {
    is: Joi.valid("toggle", "remove"),
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
});

const commentSchema = Joi.object({
  body: Joi.string().trim().min(1).max(5000).required(),
});

module.exports = {
  createDelegationSchema,
  updateDelegationSchema,
  assignSchema,
  reassignSchema,
  statusChangeSchema,
  checklistSchema,
  commentSchema,
  STATUSES,
  PRIORITIES,
  ALLOWED_TRANSITIONS,
};
