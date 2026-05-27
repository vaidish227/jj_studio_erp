const Joi = require('joi');

const OID = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

const PURPOSES = ['Measurement', 'Quality Check', 'Client Meeting at Site', 'Snag List', 'Final Handover'];

const createSiteVisitSchema = Joi.object({
  projectId:       OID.required().messages({ 'any.required': 'projectId is required' }),
  visitorId:       OID.required().messages({ 'any.required': 'visitorId is required' }),
  visitDate:       Joi.date().optional(),
  purpose:         Joi.string().valid(...PURPOSES).required(),
  observations:    Joi.string().allow('').optional(),
  actionsRequired: Joi.string().allow('').optional(),
  photos:          Joi.array().items(Joi.string()).optional(),
  nextVisitDate:   Joi.date().allow(null).optional(),
  status:          Joi.string().valid('planned', 'completed', 'cancelled').optional(),
});

const updateSiteVisitSchema = Joi.object({
  visitDate:       Joi.date().optional(),
  purpose:         Joi.string().valid(...PURPOSES).optional(),
  observations:    Joi.string().allow('').optional(),
  actionsRequired: Joi.string().allow('').optional(),
  photos:          Joi.array().items(Joi.string()).optional(),
  nextVisitDate:   Joi.date().allow(null).optional(),
  status:          Joi.string().valid('planned', 'completed', 'cancelled').optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided' });

module.exports = { createSiteVisitSchema, updateSiteVisitSchema };
