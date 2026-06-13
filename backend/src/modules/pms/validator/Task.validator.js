const Joi = require('joi');

const OID = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

const TASK_TYPES = [
  'ac_coordination', 'technical_drawing', 'kitchen_drawing', 'bathroom_drawing',
  'automation_coordination', '3d_render', 'concept_making', 'furniture_layout',
  'site_measurement', 'civil_drawing',
  // Phase 1 — Workflow Engine additions
  'mep_collection', 'concept_first_meeting', 'concept_feedback_meeting', 'handover_signoff',
  // Phase 2 — Kitchen branch children
  'kitchen_detail_elevation', 'kitchen_3d', 'kitchen_technical_drawings', 'kitchen_release_ready',
  'kitchen_vendor_purchase', 'kitchen_tentative_quote', 'kitchen_client_meeting', 'kitchen_vendor_finalization',
];

// Kitchen children grouped by routing choice. Exposed for use by workflowEngine.
const KITCHEN_CHILDREN = {
  in_house: [
    { taskType: 'kitchen_detail_elevation',    title: 'Kitchen — Detail Elevation' },
    { taskType: 'kitchen_3d',                  title: 'Kitchen — 3D Visualisation' },
    { taskType: 'kitchen_technical_drawings',  title: 'Kitchen — Technical Drawings (per checklist)' },
    { taskType: 'kitchen_release_ready',       title: 'Kitchen — Release Ready (DLR + Site)' },
  ],
  outsourced: [
    { taskType: 'kitchen_vendor_purchase',      title: 'Kitchen — Send to Vendor via Purchase' },
    { taskType: 'kitchen_tentative_quote',      title: 'Kitchen — Tentative Quote' },
    { taskType: 'kitchen_client_meeting',       title: 'Kitchen — Client Meeting' },
    { taskType: 'kitchen_vendor_finalization',  title: 'Kitchen — Vendor Finalisation' },
  ],
};

const TASK_STATUSES = [
  'not_started', 'blocked', 'in_progress',
  'pending_review', 'revision_requested',
  'pending_client_approval',
  'approved', 'released_to_site', 'completed', 'on_hold',
];

const ROUTING_OPTIONS = ['in_house', 'outsourced'];

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
  // Phase 1 — Workflow Engine (Kitchen branching)
  routing:    Joi.string().valid(...ROUTING_OPTIONS).allow(null).optional(),
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
  // Phase 1 — Workflow Engine
  routing:     Joi.string().valid(...ROUTING_OPTIONS).allow(null).optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided' });

// Gate override (Phase 1)
const gateOverrideSchema = Joi.object({
  overrideReason: Joi.string().trim().min(5).required().messages({
    'any.required': 'Override reason is required',
    'string.min':   'Override reason must be at least 5 characters',
  }),
});

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
  gateOverrideSchema,
  TASK_TYPES,
  TASK_STATUSES,
  PRIORITIES,
  ROUTING_OPTIONS,
  KITCHEN_CHILDREN,
};
