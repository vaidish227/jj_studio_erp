const Joi = require('joi');

const OID = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

const STATUSES = ['active', 'on_hold', 'completed', 'terminated'];

// email is optional but, when present, must look like an email. allow('') so the
// UI can post an empty field without a 400.
const email = Joi.string().trim().lowercase().email({ tlds: false }).allow('').optional();
// dates accept null/'' (cleared in the UI) as well as a valid date.
const optionalDate = Joi.date().allow(null, '').optional();

const createContractorSchema = Joi.object({
  projectId:     OID.required().messages({ 'any.required': 'projectId is required' }),
  name:          Joi.string().trim().min(1).max(200).required().messages({
    'any.required': 'Name is required',
    'string.empty': 'Name is required',
  }),
  company:       Joi.string().trim().allow('').max(200).optional(),
  trade:         Joi.string().trim().allow('').max(200).optional(),
  phone:         Joi.string().trim().allow('').max(50).optional(),
  email,
  address:       Joi.string().trim().allow('').max(500).optional(),
  scope:         Joi.string().trim().allow('').max(2000).optional(),
  status:        Joi.string().valid(...STATUSES).optional(),
  startDate:     optionalDate,
  endDate:       optionalDate,
  contractValue: Joi.number().min(0).optional(),
  amountPaid:    Joi.number().min(0).optional(),
  notes:         Joi.string().allow('').max(4000).optional(),
});

const updateContractorSchema = Joi.object({
  name:          Joi.string().trim().min(1).max(200).optional(),
  company:       Joi.string().trim().allow('').max(200).optional(),
  trade:         Joi.string().trim().allow('').max(200).optional(),
  phone:         Joi.string().trim().allow('').max(50).optional(),
  email,
  address:       Joi.string().trim().allow('').max(500).optional(),
  scope:         Joi.string().trim().allow('').max(2000).optional(),
  status:        Joi.string().valid(...STATUSES).optional(),
  startDate:     optionalDate,
  endDate:       optionalDate,
  contractValue: Joi.number().min(0).optional(),
  amountPaid:    Joi.number().min(0).optional(),
  notes:         Joi.string().allow('').max(4000).optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided' });

module.exports = {
  createContractorSchema,
  updateContractorSchema,
};
