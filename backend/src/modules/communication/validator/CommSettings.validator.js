const Joi = require("joi");

const providerConfigSchema = Joi.object({
  providerName: Joi.string().required(),
  config:       Joi.object().unknown(true).optional(),
});

const queueSchema = Joi.object({
  enabled:              Joi.boolean().optional(),
  maxRetries:           Joi.number().integer().min(0).max(10).optional(),
  retryIntervalMinutes: Joi.number().integer().min(1).optional(),
  batchSize:            Joi.number().integer().min(1).max(100).optional(),
}).optional();

const schedulingSchema = Joi.object({
  enabled:           Joi.boolean().optional(),
  allowedHoursStart: Joi.number().integer().min(0).max(23).optional(),
  allowedHoursEnd:   Joi.number().integer().min(0).max(23).optional(),
  weekendsAllowed:   Joi.boolean().optional(),
}).optional();

const rateLimitSchema = Joi.object({
  enabled:    Joi.boolean().optional(),
  maxPerHour: Joi.number().integer().min(1).optional(),
  maxPerDay:  Joi.number().integer().min(1).optional(),
}).optional();

const updateSettingsSchema = Joi.object({
  isActive:        Joi.boolean().optional(),
  activeProvider:  Joi.string().optional(),
  providerConfigs: Joi.array().items(providerConfigSchema).optional(),
  queue:           queueSchema,
  scheduling:      schedulingSchema,
  rateLimit:       rateLimitSchema,
}).min(1).options({ abortEarly: false });

module.exports = { updateSettingsSchema };
