const Joi = require('joi');

const OID = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

const CATEGORIES = ['Flooring', 'Fittings', 'Paint', 'Hardware', 'Lighting', 'Furniture', 'Other'];
const SELECTION_STATUSES = ['proposed', 'selected_by_client', 'ordered', 'delivered_at_site'];
const SELECTION_SOURCES = ['showroom', 'catalog', 'website', 'sample_at_office'];

const createMaterialSchema = Joi.object({
  projectId:       OID.required().messages({ 'any.required': 'projectId is required' }),
  taskId:          OID.allow('', null).optional(),
  category:        Joi.string().valid(...CATEGORIES).required(),
  itemName:        Joi.string().trim().min(1).max(200).required(),
  brand:           Joi.string().allow('').optional(),
  specification:   Joi.string().allow('').optional(),
  quantity:        Joi.number().positive().optional(),
  unit:            Joi.string().allow('').optional(),
  selectionStatus: Joi.string().valid(...SELECTION_STATUSES).optional(),
  selectedAt:      Joi.date().allow(null).optional(),
  selectionSource: Joi.string().valid(...SELECTION_SOURCES).allow('', null).optional(),
  images:          Joi.array().items(Joi.string()).optional(),
  notes:           Joi.string().allow('').optional(),
});

const updateMaterialSchema = Joi.object({
  category:        Joi.string().valid(...CATEGORIES).optional(),
  itemName:        Joi.string().trim().min(1).max(200).optional(),
  brand:           Joi.string().allow('').optional(),
  specification:   Joi.string().allow('').optional(),
  quantity:        Joi.number().positive().optional(),
  unit:            Joi.string().allow('').optional(),
  selectionStatus: Joi.string().valid(...SELECTION_STATUSES).optional(),
  selectedAt:      Joi.date().allow(null).optional(),
  selectionSource: Joi.string().valid(...SELECTION_SOURCES).allow('', null).optional(),
  images:          Joi.array().items(Joi.string()).optional(),
  notes:           Joi.string().allow('').optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided' });

module.exports = { createMaterialSchema, updateMaterialSchema };
