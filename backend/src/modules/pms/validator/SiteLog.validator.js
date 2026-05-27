const Joi = require('joi');

const OID = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

const createSiteLogSchema = Joi.object({
  projectId:       OID.required().messages({ 'any.required': 'Project ID is required' }),
  logDate:         Joi.date().required(),
  workPerformed:   Joi.string().trim().min(3).required(),
  manpowerCount:   Joi.number().min(0).optional(),
  issuesReported:  Joi.string().allow('').optional(),
  blockers:        Joi.string().allow('').optional(),
  sitePhotos:      Joi.array().items(Joi.string().uri()).optional(),
  relatedTaskId:   OID.allow('', null).optional(),
  relatedDrawingId: OID.allow('', null).optional(),
});

const updateLogSchema = Joi.object({
  workPerformed:  Joi.string().trim().optional(),
  manpowerCount:  Joi.number().min(0).optional(),
  issuesReported: Joi.string().allow('').optional(),
  blockers:       Joi.string().allow('').optional(),
  reviewStatus:   Joi.string().valid('pending', 'reviewed').optional(),
  reviewNotes:    Joi.string().allow('').optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided' });

module.exports = { createSiteLogSchema, updateLogSchema };
