const Joi = require('joi');

const OID = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

const TASK_TYPES = [
  'ac_coordination', 'technical_drawing', 'kitchen_drawing', 'bathroom_drawing',
  'automation_coordination', '3d_render', 'concept_making', 'furniture_layout', 'site_measurement',
];

const TASK_STATUSES = [
  'not_started', 'in_progress', 'pending_client_approval',
  'approved', 'released_to_site', 'completed', 'on_hold',
];

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const checklistItemSchema = Joi.object({
  item:        Joi.string().trim().required(),
  isCompleted: Joi.boolean().optional(),
  completedAt: Joi.date().allow(null).optional(),
});

const createTaskSchema = Joi.object({
  projectId:  OID.required().messages({ 'any.required': 'Project ID is required' }),
  taskType:   Joi.string().valid(...TASK_TYPES).required(),
  title:      Joi.string().trim().min(2).max(200).required(),
  assignedTo: OID.allow('', null).optional(),
  dueDate:    Joi.date().optional(),
  startDate:  Joi.date().optional(),
  priority:   Joi.string().valid(...PRIORITIES).optional(),
  notes:      Joi.string().allow('').optional(),
  checklist:  Joi.array().items(checklistItemSchema).optional(),
});

const updateTaskSchema = Joi.object({
  title:      Joi.string().trim().min(2).max(200).optional(),
  assignedTo: OID.allow('', null).optional(),
  status:     Joi.string().valid(...TASK_STATUSES).optional(),
  priority:   Joi.string().valid(...PRIORITIES).optional(),
  dueDate:    Joi.date().allow(null).optional(),
  startDate:  Joi.date().allow(null).optional(),
  notes:      Joi.string().allow('').optional(),
  checklist:  Joi.array().items(checklistItemSchema).optional(),
  externalCoordination: Joi.object({
    isNeeded:          Joi.boolean().optional(),
    vendorId:          OID.allow('', null).optional(),
    quotationUrl:      Joi.string().allow('').optional(),
    amount:            Joi.number().optional(),
    isApprovedByClient: Joi.boolean().optional(),
  }).optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided' });

const checklistUpdateSchema = Joi.object({
  isCompleted: Joi.boolean().required(),
});

module.exports = { createTaskSchema, updateTaskSchema, checklistUpdateSchema };
