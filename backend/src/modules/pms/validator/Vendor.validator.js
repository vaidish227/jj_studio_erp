const Joi = require('joi');

const CATEGORIES = ['AC', 'Automation', 'Kitchen', 'Carpentry', 'Electrical', 'Plumbing', 'Other'];
const STATUSES   = ['active', 'inactive', 'blacklisted'];

const createVendorSchema = Joi.object({
  name:          Joi.string().trim().min(2).max(150).required(),
  category:      Joi.string().valid(...CATEGORIES).optional(),
  contactPerson: Joi.string().allow('').optional(),
  phone:         Joi.string().trim().required().messages({ 'any.required': 'Phone number is required' }),
  email:         Joi.string().email().allow('').optional(),
  address:       Joi.string().allow('').optional(),
  notes:         Joi.string().allow('').optional(),
  rating:        Joi.number().min(0).max(5).optional(),
  status:        Joi.string().valid(...STATUSES).optional(),
});

const updateVendorSchema = Joi.object({
  name:          Joi.string().trim().min(2).max(150).optional(),
  category:      Joi.string().valid(...CATEGORIES).optional(),
  contactPerson: Joi.string().allow('').optional(),
  phone:         Joi.string().trim().optional(),
  email:         Joi.string().email().allow('').optional(),
  address:       Joi.string().allow('').optional(),
  notes:         Joi.string().allow('').optional(),
  rating:        Joi.number().min(0).max(5).optional(),
  status:        Joi.string().valid(...STATUSES).optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided' });

module.exports = { createVendorSchema, updateVendorSchema };
