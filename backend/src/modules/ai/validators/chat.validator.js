const Joi = require("joi");
const aiConfig = require("../config/aiConfig");

const chatSchema = Joi.object({
  conversationId: Joi.string().hex().length(24).optional().allow(null, ""),
  message: Joi.string()
    .trim()
    .min(1)
    .max(aiConfig.limits.inputCharLimit)
    .required(),
});

const feedbackSchema = Joi.object({
  messageId: Joi.string().hex().length(24).required(),
  rating: Joi.number().valid(-1, 1).required(),
  reason: Joi.string().max(1000).optional().allow(""),
});

const renameSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
});

function validate(schema, payload) {
  const { value, error } = schema.validate(payload, { stripUnknown: true });
  if (error) {
    const e = new Error(error.details?.[0]?.message || "Invalid request");
    e.statusCode = 400;
    throw e;
  }
  return value;
}

module.exports = { chatSchema, feedbackSchema, renameSchema, validate };
