const Joi = require("joi");
const {
  CHANNELS, CAMPAIGN_AUDIENCES, CAMPAIGN_STATUSES, DELAY_UNITS, ENTITY_TYPES,
} = require("../constants/enums");

const OID = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

const delaySchema = Joi.object({
  value: Joi.number().min(0).default(0),
  unit:  Joi.string().valid(...DELAY_UNITS).default("days"),
});

const conditionSchema = Joi.object({
  field:    Joi.string(),
  operator: Joi.string(),
  value:    Joi.any(),
});

// ─── Campaign ─────────────────────────────────────────────────────────────────
const createCampaignSchema = Joi.object({
  name:           Joi.string().min(2).max(120).required(),
  description:    Joi.string().allow(""),
  audience:       Joi.string().valid(...CAMPAIGN_AUDIENCES).default("leads"),
  status:         Joi.string().valid(...CAMPAIGN_STATUSES).default("draft"),
  defaultChannel: Joi.string().valid(...CHANNELS).default("whatsapp"),
  isReusable:     Joi.boolean().default(true),
}).options({ abortEarly: false });

const updateCampaignSchema = Joi.object({
  name:           Joi.string().min(2).max(120),
  description:    Joi.string().allow(""),
  audience:       Joi.string().valid(...CAMPAIGN_AUDIENCES),
  status:         Joi.string().valid(...CAMPAIGN_STATUSES),
  defaultChannel: Joi.string().valid(...CHANNELS),
  isReusable:     Joi.boolean(),
}).min(1).options({ abortEarly: false });

// ─── Step ─────────────────────────────────────────────────────────────────────
const createStepSchema = Joi.object({
  name:       Joi.string().allow(""),
  order:      Joi.number().min(0),          // optional — appended if omitted
  delay:      delaySchema.default({ value: 0, unit: "days" }),
  channel:    Joi.string().valid(...CHANNELS).required(),
  templateId: OID.required(),
  condition:  conditionSchema,
}).options({ abortEarly: false });

const updateStepSchema = Joi.object({
  name:       Joi.string().allow(""),
  order:      Joi.number().min(0),
  delay:      delaySchema,
  channel:    Joi.string().valid(...CHANNELS),
  templateId: OID,
  condition:  conditionSchema.allow(null),
}).min(1).options({ abortEarly: false });

const reorderSchema = Joi.object({
  order: Joi.array().items(OID).min(1).required(),
}).options({ abortEarly: false });

// ─── Enroll ───────────────────────────────────────────────────────────────────
const enrollSchema = Joi.object({
  entityType: Joi.string().valid(...ENTITY_TYPES).required(),
  entityIds:  Joi.array().items(OID).min(1).required(),
}).options({ abortEarly: false });

module.exports = {
  createCampaignSchema, updateCampaignSchema,
  createStepSchema, updateStepSchema, reorderSchema,
  enrollSchema,
};
