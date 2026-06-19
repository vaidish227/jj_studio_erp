const Joi = require('joi');

const OID = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

const SEVERITIES = ['low', 'medium', 'high'];
const STATUSES   = ['open', 'in_progress', 'resolved', 'closed'];

const createSnagSchema = Joi.object({
  projectId:   OID.required().messages({ 'any.required': 'projectId is required' }),
  title:       Joi.string().trim().min(1).max(200).required().messages({
    'any.required': 'Title is required',
    'string.empty': 'Title is required',
  }),
  issue:       Joi.string().trim().allow('').max(500).optional(),
  location:    Joi.string().trim().allow('').max(200).optional(),
  area:        Joi.string().trim().allow('').max(200).optional(),
  zone:        Joi.string().trim().allow('').max(200).optional(),
  severity:    Joi.string().valid(...SEVERITIES).optional(),
  status:      Joi.string().valid(...STATUSES).optional(),
  description: Joi.string().allow('').max(4000).optional(),
});

const updateSnagSchema = Joi.object({
  title:       Joi.string().trim().min(1).max(200).optional(),
  issue:       Joi.string().trim().allow('').max(500).optional(),
  location:    Joi.string().trim().allow('').max(200).optional(),
  area:        Joi.string().trim().allow('').max(200).optional(),
  zone:        Joi.string().trim().allow('').max(200).optional(),
  severity:    Joi.string().valid(...SEVERITIES).optional(),
  status:      Joi.string().valid(...STATUSES).optional(),
  description: Joi.string().allow('').max(4000).optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided' });

module.exports = {
  createSnagSchema,
  updateSnagSchema,
};
