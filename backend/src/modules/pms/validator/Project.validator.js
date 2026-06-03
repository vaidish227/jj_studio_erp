const Joi = require('joi');

const OID = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

const PROJECT_STATUSES = [
  'design_phase', 'execution_phase', 'handover', 'completed', 'on_hold', 'cancelled',
];

const PROJECT_PHASES = [
  'kickoff', 'layout', 'design', 'procurement', 'release', 'execution', 'handover',
];

const CLIENT_APPROVAL_TYPES = [
  // furniture_layout added in Phase 1 — gates the parallel design tracks
  'furniture_layout',
  'ac', 'automation', 'kitchen', 'bathroom_material', 'cp_fittings', 'wall_floor_material',
];

const addressSchema = Joi.object({
  fullAddress:  Joi.string().trim().optional(),
  buildingName: Joi.string().allow('').optional(),
  tower:        Joi.string().allow('').optional(),
  unit:         Joi.string().allow('').optional(),
  floor:        Joi.string().allow('').optional(),
  city:         Joi.string().allow('').optional(),
});

const createProjectSchema = Joi.object({
  clientId:   OID.required().messages({
    'string.pattern.base': 'clientId must be a valid MongoDB ObjectId',
    'any.required':        'Client is required',
  }),
  proposalId: OID.allow('', null).optional(),
  name:        Joi.string().trim().min(2).max(200).required(),
  projectType: Joi.string().valid('Residential', 'Commercial').required(),

  siteAddress: Joi.object({
    fullAddress:  Joi.string().trim().required().messages({ 'any.required': 'Site address is required' }),
    buildingName: Joi.string().allow('').optional(),
    tower:        Joi.string().allow('').optional(),
    unit:         Joi.string().allow('').optional(),
    floor:        Joi.string().allow('').optional(),
    city:         Joi.string().allow('').optional(),
  }).required(),

  area:   Joi.number().positive().optional(),
  budget: Joi.number().positive().optional(),

  primaryDesigner: OID.allow('', null).optional(),
  supervisor:      OID.allow('', null).optional(),

  estimatedCompletionDate: Joi.date().optional(),
  notes: Joi.string().allow('').optional(),
  tags:  Joi.array().items(Joi.string()).optional(),
});

const updateProjectSchema = Joi.object({
  name:        Joi.string().trim().min(2).max(200).optional(),
  projectType: Joi.string().valid('Residential', 'Commercial').optional(),
  status:      Joi.string().valid(...PROJECT_STATUSES).optional(),
  siteAddress: addressSchema.optional(),
  area:        Joi.number().positive().optional(),
  budget:      Joi.number().positive().optional(),
  estimatedCompletionDate: Joi.date().allow(null).optional(),
  actualCompletionDate:    Joi.date().allow(null).optional(),
  startDate: Joi.date().optional(),
  notes:     Joi.string().allow('').optional(),
  tags:      Joi.array().items(Joi.string()).optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided' });

const kickstartSchema = Joi.object({
  mainGroupCreated:        Joi.boolean().optional(),
  drawingGroupCreated:     Joi.boolean().optional(),
  supervisionGroupCreated: Joi.boolean().optional(),
  paymentGroupCreated:     Joi.boolean().optional(),
  detailFormSentToClient:  Joi.boolean().optional(),
  labourQuotationSent:     Joi.boolean().optional(),
}).min(1).messages({ 'object.min': 'At least one kickstart field must be provided' });

const teamSchema = Joi.object({
  primaryDesigner: OID.allow('', null).optional(),
  supervisor:      OID.allow('', null).optional(),
  designerB:       OID.allow('', null).optional(),
  designerC:       OID.allow('', null).optional(),
  designerD:       OID.allow('', null).optional(),
  designerE:       OID.allow('', null).optional(),
  contractor:      OID.allow('', null).optional(),
}).min(1).messages({ 'object.min': 'At least one team member field must be provided' });

const clientApprovalSchema = Joi.object({
  type:       Joi.string().valid(...CLIENT_APPROVAL_TYPES).required(),
  status:     Joi.string().valid('pending', 'obtained', 'not_applicable').optional(),
  obtainedAt: Joi.date().allow(null).optional(),
  notes:      Joi.string().allow('').optional(),
});

module.exports = {
  createProjectSchema,
  updateProjectSchema,
  kickstartSchema,
  teamSchema,
  clientApprovalSchema,
  PROJECT_STATUSES,
  PROJECT_PHASES,
  CLIENT_APPROVAL_TYPES,
};
