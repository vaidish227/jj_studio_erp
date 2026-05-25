const Joi = require('joi');

const OID = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

const createMilestoneSchema = Joi.object({
  projectId:   OID.required().messages({ 'any.required': 'projectId is required' }),
  title:       Joi.string().trim().min(2).max(200).required(),
  description: Joi.string().allow('').optional(),
  dueDate:     Joi.date().required().messages({ 'any.required': 'dueDate is required' }),
  assignedTo:  OID.allow('', null).optional(),
  isCritical:  Joi.boolean().optional(),
  order:       Joi.number().integer().min(0).optional(),
});

const updateMilestoneSchema = Joi.object({
  title:         Joi.string().trim().min(2).max(200).optional(),
  description:   Joi.string().allow('').optional(),
  dueDate:       Joi.date().allow(null).optional(),
  completedDate: Joi.date().allow(null).optional(),
  status:        Joi.string().valid('pending', 'in_progress', 'completed', 'delayed').optional(),
  assignedTo:    OID.allow('', null).optional(),
  isCritical:    Joi.boolean().optional(),
  order:         Joi.number().integer().min(0).optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided' });

module.exports = { createMilestoneSchema, updateMilestoneSchema };
