const Joi = require("joi");

const OID = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

const requestHandoverSchema = Joi.object({
  drawingIds:    Joi.array().items(OID).min(1).optional(),  // explicit subset; default = all released drawings
  notes:         Joi.string().allow("").optional(),
  supervisorId:  OID.allow("", null).optional(),
});

const updateDrawingItemSchema = Joi.object({
  walked: Joi.boolean().required(),
  notes:  Joi.string().allow("").optional(),
});

const addPunchItemSchema = Joi.object({
  description: Joi.string().trim().min(3).required(),
  severity:    Joi.string().valid("minor", "major", "blocker").default("minor"),
});

const resolvePunchItemSchema = Joi.object({
  resolution: Joi.string().trim().min(3).required(),
});

const designLeadSignSchema = Joi.object({
  notes: Joi.string().allow("").optional(),
});

const supervisorAcceptSchema = Joi.object({
  notes: Joi.string().allow("").optional(),
});

const supervisorRejectSchema = Joi.object({
  rejectionReason: Joi.string().trim().min(5).required(),
});

module.exports = {
  requestHandoverSchema,
  updateDrawingItemSchema,
  addPunchItemSchema,
  resolvePunchItemSchema,
  designLeadSignSchema,
  supervisorAcceptSchema,
  supervisorRejectSchema,
};
