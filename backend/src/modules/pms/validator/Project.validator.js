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

// Dynamic team assignments. Each row is either a master responsibility
// (responsibilityId) or a per-project custom work item (customName).
// At least one of the two must be present per row.
const teamSchema = Joi.object({
  assignments: Joi.array()
    .items(
      Joi.object({
        responsibilityId: OID.allow('', null).optional(),
        customName: Joi.string().trim().min(1).max(100).optional(),
        userIds: Joi.array().items(OID).default([]),
      }).custom((row, helpers) => {
        if (!row.responsibilityId && !row.customName) {
          return helpers.error('any.invalid', {
            message: 'Each assignment needs a responsibility or a custom name',
          });
        }
        return row;
      }, 'row identity')
    )
    .required()
    .custom((value, helpers) => {
      // Uniqueness — by responsibilityId for master rows, by lowercased
      // customName for custom rows. Both kinds cannot collide because they
      // live in different keyspaces.
      const seenIds = new Set();
      const seenNames = new Set();
      for (const row of value) {
        if (row.responsibilityId) {
          if (seenIds.has(row.responsibilityId)) {
            return helpers.error('any.invalid', {
              message: 'Each responsibility may only appear once per project',
            });
          }
          seenIds.add(row.responsibilityId);
        } else if (row.customName) {
          const key = row.customName.trim().toLowerCase();
          if (seenNames.has(key)) {
            return helpers.error('any.invalid', {
              message: `Custom work item "${row.customName}" appears more than once`,
            });
          }
          seenNames.add(key);
        }
      }
      return value;
    }, 'unique rows'),
});

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
