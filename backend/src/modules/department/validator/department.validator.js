const Joi = require("joi");

const SLUG_PATTERN = /^[a-z0-9_-]+$/;

const createDepartmentSchema = Joi.object({
  name: Joi.string().trim().min(2).max(60).required(),
  // Optional — auto-derived from name in the controller when omitted.
  slug: Joi.string()
    .lowercase()
    .pattern(SLUG_PATTERN)
    .min(2)
    .max(40)
    .optional()
    .messages({
      "string.pattern.base":
        "slug must be lowercase letters, numbers, hyphens, and underscores only",
    }),
  color: Joi.string().trim().max(20).optional(),
  icon: Joi.string().trim().max(40).allow("").optional(),
  order: Joi.number().integer().min(0).optional(),
  isActive: Joi.boolean().optional(),
});

const updateDepartmentSchema = Joi.object({
  name: Joi.string().trim().min(2).max(60).optional(),
  slug: Joi.string()
    .lowercase()
    .pattern(SLUG_PATTERN)
    .min(2)
    .max(40)
    .optional()
    .messages({
      "string.pattern.base":
        "slug must be lowercase letters, numbers, hyphens, and underscores only",
    }),
  color: Joi.string().trim().max(20).optional(),
  icon: Joi.string().trim().max(40).allow("").optional(),
  order: Joi.number().integer().min(0).optional(),
  isActive: Joi.boolean().optional(),
})
  .min(1)
  .messages({ "object.min": "At least one field must be provided" });

module.exports = {
  createDepartmentSchema,
  updateDepartmentSchema,
  SLUG_PATTERN,
};
