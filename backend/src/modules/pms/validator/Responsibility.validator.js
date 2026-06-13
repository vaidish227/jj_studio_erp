const Joi = require("joi");

const OID = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

const SLUG_PATTERN = /^[a-z0-9_]+$/;

const CATEGORIES = ["design", "site", "exec", "other"];

// Slugs that map to downstream slug-based lookups (notifications, handover,
// vendor groups). Cannot be deleted; their slug and system flag are immutable.
const RESERVED_SLUGS = ["lead_designer", "supervisor"];

const createResponsibilitySchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  slug: Joi.string()
    .lowercase()
    .pattern(SLUG_PATTERN)
    .min(2)
    .max(40)
    .required()
    .messages({
      "string.pattern.base": "slug must be lowercase letters, numbers, and underscores only",
    }),
  category: Joi.string().valid(...CATEGORIES).optional(),
  defaultRoles: Joi.array().items(Joi.string()).optional(),
  vendorKinds: Joi.array().items(Joi.string()).optional(),
  icon: Joi.string().allow("").optional(),
  color: Joi.string().allow("").optional(),
  order: Joi.number().integer().min(0).optional(),
  isActive: Joi.boolean().optional(),
});

const updateResponsibilitySchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).optional(),
  category: Joi.string().valid(...CATEGORIES).optional(),
  defaultRoles: Joi.array().items(Joi.string()).optional(),
  vendorKinds: Joi.array().items(Joi.string()).optional(),
  icon: Joi.string().allow("").optional(),
  color: Joi.string().allow("").optional(),
  order: Joi.number().integer().min(0).optional(),
  isActive: Joi.boolean().optional(),
})
  .min(1)
  .messages({ "object.min": "At least one field must be provided" });

module.exports = {
  createResponsibilitySchema,
  updateResponsibilitySchema,
  RESERVED_SLUGS,
  CATEGORIES,
};
