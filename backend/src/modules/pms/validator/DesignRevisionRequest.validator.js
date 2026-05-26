const Joi = require("joi");

const createRevisionRequestSchema = Joi.object({
  drawingId:     Joi.string().hex().length(24).required(),
  revisionNotes: Joi.string().trim().min(1).max(2000).required(),
  specificItems: Joi.array().items(Joi.string().trim().max(500)).default([]),
  deadline:      Joi.date().iso().optional().allow(null),
});

const resolveRevisionRequestSchema = Joi.object({
  resubmittedDrawingVersion: Joi.number().integer().min(1).optional(),
});

module.exports = { createRevisionRequestSchema, resolveRevisionRequestSchema };
