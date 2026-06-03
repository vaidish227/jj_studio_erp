const Joi = require('joi');

const OID = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

const APPROVER_TYPES = ['client', 'manager', 'principal_designer', 'principal_and_client'];

const requestApprovalSchema = Joi.object({
  projectId:    OID.required().messages({ 'any.required': 'projectId is required' }),
  targetType:   Joi.string().valid('drawing', 'concept', 'material', 'quotation').required(),
  targetId:     OID.required().messages({ 'any.required': 'targetId is required' }),
  approverType: Joi.string().valid(...APPROVER_TYPES).required(),
  approverId:   OID.allow('', null).optional(),
  comments:     Joi.string().allow('').optional(),
  attachments:  Joi.array().items(Joi.string()).optional(),
  // Phase 1: gate link is optional; engine sets it server-side
  gateId:       OID.allow('', null).optional(),
});

const respondToApprovalSchema = Joi.object({
  status:      Joi.string().valid('approved', 'rejected', 'approved_with_changes').required(),
  comments:    Joi.string().allow('').optional(),
  attachments: Joi.array().items(Joi.string()).optional(),
}).min(1);

module.exports = { requestApprovalSchema, respondToApprovalSchema, APPROVER_TYPES };
