const Joi = require("joi");

const OID  = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);
const EMAIL = Joi.string().email({ tlds: { allow: false } });

const toField = Joi.alternatives()
  .try(EMAIL, Joi.array().items(EMAIL).min(1))
  .required()
  .messages({ "alternatives.match": "to must be a valid email or array of emails" });

const relatedToSchema = Joi.object({
  module:   Joi.string().valid("crm", "proposal", "pms", "manual", "system").required(),
  recordId: OID.required(),
}).optional();

const sendMailSchema = Joi.object({
  to:                toField,
  cc:                Joi.alternatives().try(EMAIL, Joi.array().items(EMAIL)).optional(),
  bcc:               Joi.alternatives().try(EMAIL, Joi.array().items(EMAIL)).optional(),
  subject:           Joi.string().max(500).when("templateId", { is: Joi.exist(), then: Joi.optional(), otherwise: Joi.required() }),
  html:              Joi.string().optional(),
  text:              Joi.string().optional(),
  templateId:        OID.optional(),
  templateVariables: Joi.object().optional(),
  relatedTo:         relatedToSchema,
}).options({ abortEarly: false });

const scheduleMailSchema = Joi.object({
  to:                toField,
  cc:                Joi.alternatives().try(EMAIL, Joi.array().items(EMAIL)).optional(),
  bcc:               Joi.alternatives().try(EMAIL, Joi.array().items(EMAIL)).optional(),
  subject:           Joi.string().max(500).when("templateId", { is: Joi.exist(), then: Joi.optional(), otherwise: Joi.required() }),
  html:              Joi.string().optional(),
  text:              Joi.string().optional(),
  templateId:        OID.optional(),
  templateVariables: Joi.object().optional(),
  scheduledFor:      Joi.date().min("now").required(),
  priority:          Joi.string().valid("low", "normal", "high", "urgent").default("normal"),
  maxRetries:        Joi.number().integer().min(0).max(10).default(3),
  relatedTo:         relatedToSchema,
}).options({ abortEarly: false });

const createTemplateSchema = Joi.object({
  name:      Joi.string().min(2).max(100).required(),
  category:  Joi.string().valid("welcome", "meeting", "proposal", "followup", "reminder", "approval", "marketing", "system", "custom").default("custom"),
  subject:   Joi.string().min(1).max(500).required(),
  htmlBody:  Joi.string().min(10).required(),
  textBody:  Joi.string().optional(),
  variables: Joi.array().items(Joi.string().trim()).optional(),
}).options({ abortEarly: false });

const updateTemplateSchema = Joi.object({
  name:      Joi.string().min(2).max(100).optional(),
  category:  Joi.string().valid("welcome", "meeting", "proposal", "followup", "reminder", "approval", "marketing", "system", "custom").optional(),
  subject:   Joi.string().min(1).max(500).optional(),
  htmlBody:  Joi.string().min(10).optional(),
  textBody:  Joi.string().optional(),
  variables: Joi.array().items(Joi.string().trim()).optional(),
  isActive:  Joi.boolean().optional(),
}).min(1).options({ abortEarly: false });

module.exports = { sendMailSchema, scheduleMailSchema, createTemplateSchema, updateTemplateSchema };
