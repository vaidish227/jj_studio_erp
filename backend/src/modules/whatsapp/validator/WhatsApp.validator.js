const Joi = require("joi");

const OID   = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);
const PHONE = Joi.string().pattern(/^[\d\+\-\s\(\)]{7,20}$/).messages({
  "string.pattern.base": "to must be a valid phone number",
});

const relatedToSchema = Joi.object({
  module:   Joi.string().valid("crm", "proposal", "pms", "manual", "system").required(),
  recordId: OID.required(),
}).optional();

const sendMessageSchema = Joi.object({
  to:                PHONE.required(),
  message:           Joi.string().when("templateId", { is: Joi.exist(), then: Joi.optional(), otherwise: Joi.required() }),
  templateId:        OID.optional(),
  templateVariables: Joi.object().optional(),
  mediaUrl:          Joi.string().uri().optional(),
  mediaType:         Joi.string().valid("none", "image", "document", "video").default("none"),
  relatedTo:         relatedToSchema,
}).options({ abortEarly: false });

const scheduleMessageSchema = Joi.object({
  to:                PHONE.required(),
  message:           Joi.string().when("templateId", { is: Joi.exist(), then: Joi.optional(), otherwise: Joi.required() }),
  templateId:        OID.optional(),
  templateVariables: Joi.object().optional(),
  mediaUrl:          Joi.string().uri().optional(),
  mediaType:         Joi.string().valid("none", "image", "document", "video").default("none"),
  scheduledFor:      Joi.date().min("now").required(),
  priority:          Joi.string().valid("low", "normal", "high", "urgent").default("normal"),
  maxRetries:        Joi.number().integer().min(0).max(10).default(3),
  relatedTo:         relatedToSchema,
}).options({ abortEarly: false });

const createTemplateSchema = Joi.object({
  name:      Joi.string().min(2).max(100).required(),
  category:  Joi.string().valid("welcome", "meeting", "proposal", "followup", "reminder", "approval", "marketing", "system", "custom").default("custom"),
  body:      Joi.string().min(3).required(),
  variables: Joi.array().items(Joi.string().trim()).optional(),
  mediaType: Joi.string().valid("none", "image", "document", "video").default("none"),
  mediaUrl:  Joi.string().uri().optional(),
}).options({ abortEarly: false });

const updateTemplateSchema = Joi.object({
  name:      Joi.string().min(2).max(100).optional(),
  category:  Joi.string().valid("welcome", "meeting", "proposal", "followup", "reminder", "approval", "marketing", "system", "custom").optional(),
  body:      Joi.string().min(3).optional(),
  variables: Joi.array().items(Joi.string().trim()).optional(),
  mediaType: Joi.string().valid("none", "image", "document", "video").optional(),
  mediaUrl:  Joi.string().uri().allow("", null).optional(),
  isActive:  Joi.boolean().optional(),
}).min(1).options({ abortEarly: false });

module.exports = { sendMessageSchema, scheduleMessageSchema, createTemplateSchema, updateTemplateSchema };
