const Joi = require("joi");
const {
  SOURCE_MODULES, CONDITION_OPERATORS, ACTION_TYPES, CHANNELS, DELAY_UNITS,
} = require("../constants/enums");

const OID = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

const delaySchema = Joi.object({
  value: Joi.number().min(0).default(0),
  unit:  Joi.string().valid(...DELAY_UNITS).default("days"),
});

const conditionSchema = Joi.object({
  field:    Joi.string().required(),
  operator: Joi.string().valid(...CONDITION_OPERATORS).required(),
  value:    Joi.any(),
});

const actionSchema = Joi.object({
  type:       Joi.string().valid(...ACTION_TYPES).required(),
  campaignId: OID,
  templateId: OID,
  channel:    Joi.string().valid(...CHANNELS),
  delay:      delaySchema,
  params:     Joi.object(),
})
  // Enforce the id a given action type needs.
  .when(Joi.object({ type: Joi.valid("start_campaign", "stop_campaign") }).unknown(), {
    then: Joi.object({ campaignId: OID.required() }),
  })
  .when(Joi.object({ type: Joi.valid("send_template") }).unknown(), {
    then: Joi.object({ templateId: OID.required() }),
  });

const triggerSchema = Joi.object({
  event:        Joi.string().required(),
  sourceModule: Joi.string().valid(...SOURCE_MODULES).required(),
});

const createWorkflowSchema = Joi.object({
  name:        Joi.string().min(2).max(120).required(),
  description: Joi.string().allow(""),
  isActive:    Joi.boolean().default(false),
  trigger:     triggerSchema.required(),
  conditions:  Joi.array().items(conditionSchema).default([]),
  actions:     Joi.array().items(actionSchema).min(1).required(),
}).options({ abortEarly: false });

const updateWorkflowSchema = Joi.object({
  name:        Joi.string().min(2).max(120),
  description: Joi.string().allow(""),
  isActive:    Joi.boolean(),
  trigger:     triggerSchema,
  conditions:  Joi.array().items(conditionSchema),
  actions:     Joi.array().items(actionSchema).min(1),
}).min(1).options({ abortEarly: false });

module.exports = { createWorkflowSchema, updateWorkflowSchema };
