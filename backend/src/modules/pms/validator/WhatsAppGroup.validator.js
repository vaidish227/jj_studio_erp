const Joi = require('joi');

const OID = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

const memberSchema = Joi.object({
  phone: Joi.string().trim().required(),
  name:  Joi.string().allow('').optional(),
  role:  Joi.string().allow('').optional(),
});

const createGroupSchema = Joi.object({
  projectId:       OID.required().messages({ 'any.required': 'projectId is required' }),
  groupType:       Joi.string().valid('main', 'drawing', 'supervision', 'payment', 'custom').required(),
  groupName:       Joi.string().trim().min(2).max(100).required(),
  providerGroupId: Joi.string().allow('', null).optional(),
  members:         Joi.array().items(memberSchema).optional(),
  notes:           Joi.string().allow('').optional(),
});

const updateGroupSchema = Joi.object({
  groupName:       Joi.string().trim().min(2).max(100).optional(),
  providerGroupId: Joi.string().allow('', null).optional(),
  members:         Joi.array().items(memberSchema).optional(),
  isActive:        Joi.boolean().optional(),
  notes:           Joi.string().allow('').optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided' });

const sendUpdateSchema = Joi.object({
  message:    Joi.string().trim().min(1).required(),
  templateId: OID.allow('', null).optional(),
  templateVariables: Joi.object().optional(),
  mediaUrl:   Joi.string().allow('', null).optional(),
});

module.exports = { createGroupSchema, updateGroupSchema, sendUpdateSchema };
