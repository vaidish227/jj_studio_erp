const Joi = require("joi");

const addCommentSchema = Joi.object({
  content: Joi.string().trim().min(1).max(2000).required(),
  commentType: Joi.string()
    .valid("review_note", "revision_request", "designer_response", "general")
    .default("general"),
  attachmentUrl: Joi.string().uri().optional().allow("", null),
});

module.exports = { addCommentSchema };
