const Joi = require('joi');

const OID = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

const STATUSES = ['draft', 'finalized'];

const createMaterialFinalizationSchema = Joi.object({
  projectId:     OID.required().messages({ 'any.required': 'projectId is required' }),
  title:         Joi.string().trim().min(1).max(200).required().messages({
    'any.required': 'Title is required',
    'string.empty': 'Title is required',
  }),
  category:      Joi.string().trim().allow('').max(120).optional(),
  brand:         Joi.string().trim().allow('').max(200).optional(),
  specification: Joi.string().trim().allow('').max(500).optional(),
  description:   Joi.string().allow('').max(4000).optional(),
  status:        Joi.string().valid(...STATUSES).optional(),
});

const updateMaterialFinalizationSchema = Joi.object({
  title:         Joi.string().trim().min(1).max(200).optional(),
  category:      Joi.string().trim().allow('').max(120).optional(),
  brand:         Joi.string().trim().allow('').max(200).optional(),
  specification: Joi.string().trim().allow('').max(500).optional(),
  description:   Joi.string().allow('').max(4000).optional(),
  status:        Joi.string().valid(...STATUSES).optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided' });

module.exports = {
  createMaterialFinalizationSchema,
  updateMaterialFinalizationSchema,
};
