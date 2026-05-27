const Joi = require("joi");

const OID = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

// Phone: must be at least 10 digits after stripping non-digit chars
const phoneSchema = Joi.string()
  .pattern(/^[\d\s\-+().]{10,20}$/)
  .required()
  .messages({
    "string.pattern.base": "Phone must be a valid number with country code (e.g. +91 9617980134)",
  });

// ─── Member sub-schema ────────────────────────────────────────────────────────

const memberSchema = Joi.object({
  userId:     OID.allow("", null).optional(),
  phone:      phoneSchema,
  name:       Joi.string().allow("").optional(),
  role:       Joi.string().allow("").optional(),
  memberType: Joi.string().valid("team_member", "client", "external").default("team_member"),
});

// ─── Group CRUD schemas ───────────────────────────────────────────────────────

const createGroupSchema = Joi.object({
  projectId:       OID.required().messages({ "any.required": "projectId is required" }),
  groupType:       Joi.string().valid("main", "drawing", "supervision", "payment", "custom").required(),
  groupName:       Joi.string().trim().min(2).max(100).required(),
  providerGroupId: Joi.string().allow("", null).optional(),
  members:         Joi.array().items(memberSchema).optional(),
  notes:           Joi.string().allow("").optional(),
});

const updateGroupSchema = Joi.object({
  groupName:       Joi.string().trim().min(2).max(100).optional(),
  providerGroupId: Joi.string().allow("", null).optional(),
  isActive:        Joi.boolean().optional(),
  notes:           Joi.string().allow("").optional(),
}).min(1).messages({ "object.min": "At least one field must be provided" });

// ─── Member management schemas ────────────────────────────────────────────────

const addMemberSchema = Joi.object({
  userId:     OID.allow("", null).optional(),
  phone:      phoneSchema,
  name:       Joi.string().allow("").optional(),
  role:       Joi.string().allow("").optional(),
  memberType: Joi.string().valid("team_member", "client", "external").default("team_member"),
});

const removeMemberSchema = Joi.object({
  phone: phoneSchema,
});

// ─── Broadcast schema ─────────────────────────────────────────────────────────

const sendUpdateSchema = Joi.object({
  message:           Joi.string().trim().min(1).required(),
  templateId:        OID.allow("", null).optional(),
  templateVariables: Joi.object().optional(),
  mediaUrl:          Joi.string().allow("", null).optional(),
});

module.exports = {
  createGroupSchema,
  updateGroupSchema,
  addMemberSchema,
  removeMemberSchema,
  sendUpdateSchema,
};
