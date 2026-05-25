const Joi = require('joi');

const OID = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

const TASK_TYPES = [
  'ac_coordination', 'technical_drawing', 'kitchen_drawing', 'bathroom_drawing',
  'automation_coordination', '3d_render', 'concept_making', 'furniture_layout',
  'site_measurement', 'civil_drawing',
];

const TASK_STATUSES = [
  'not_started', 'in_progress',
  'pending_review', 'revision_requested',
  'pending_client_approval',
  'approved', 'released_to_site', 'completed', 'on_hold',
];

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const checklistItemSchema = Joi.object({
  item:        Joi.string().trim().required(),
  isCompleted: Joi.boolean().optional(),
  completedAt: Joi.date().allow(null).optional(),
});

const externalCoordinationSchema = Joi.object({
  isNeeded:           Joi.boolean().optional(),
  vendorId:           OID.allow('', null).optional(),
  quotationUrl:       Joi.string().allow('').optional(),
  amount:             Joi.number().optional(),
  isApprovedByClient: Joi.boolean().optional(),
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
  externalCoordination: externalCoordinationSchema.optional(),
  // Notification flags — stripped before DB insert, used for side-effects only
  notifyMail:     Joi.boolean().optional(),
  notifyWhatsApp: Joi.boolean().optional(),
});

const updateTaskSchema = Joi.object({
  title:       Joi.string().trim().min(2).max(200).optional(),
  assignedTo:  OID.allow('', null).optional(),
  status:      Joi.string().valid(...TASK_STATUSES).optional(),
  priority:    Joi.string().valid(...PRIORITIES).optional(),
  dueDate:     Joi.date().allow(null).optional(),
  startDate:   Joi.date().allow(null).optional(),
  notes:       Joi.string().allow('').optional(),
  holdReason:  Joi.string().allow('').optional(),
  delayReason: Joi.string().allow('').optional(),
  checklist:   Joi.array().items(checklistItemSchema).optional(),
  externalCoordination: externalCoordinationSchema.optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided' });

const checklistUpdateSchema = Joi.object({
  isCompleted: Joi.boolean().required(),
});

// Designer submits task for PM/PC/MD review
const submitTaskSchema = Joi.object({
  submissionNotes: Joi.string().allow('').optional(),
});

// PM/PC/MD approves task
const approveTaskSchema = Joi.object({
  remarks: Joi.string().allow('').optional(),
});

// PM/PC/MD requests revision from designer
const requestRevisionSchema = Joi.object({
  revisionInstructions: Joi.string().trim().min(5).required()
    .messages({ 'any.required': 'Revision instructions are required', 'string.min': 'Instructions must be at least 5 characters' }),
  revisionDeadline: Joi.date().allow(null).optional(),
});

// PM/PC/MD reassigns task to different designer
const reassignTaskSchema = Joi.object({
  assignedTo:       OID.required().messages({ 'any.required': 'Assignee is required' }),
  reassignedReason: Joi.string().allow('').optional(),
  priority:         Joi.string().valid(...PRIORITIES).optional(),
  startDate:        Joi.date().allow(null).optional(),
  dueDate:          Joi.date().allow(null).optional(),
  notifyMail:       Joi.boolean().optional(),
  notifyWhatsApp:   Joi.boolean().optional(),
});

module.exports = {
  createTaskSchema,
  updateTaskSchema,
  checklistUpdateSchema,
  submitTaskSchema,
  approveTaskSchema,
  requestRevisionSchema,
  reassignTaskSchema,
};
