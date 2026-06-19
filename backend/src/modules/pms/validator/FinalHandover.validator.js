const Joi = require('joi');

// Final Handover uploads are multipart (file + fields); the controller validates
// projectId / name directly (mirroring Document.controller). This schema covers
// the metadata PATCH path so edits stay consistent with the other modules.
const updateFinalHandoverSchema = Joi.object({
  name:        Joi.string().trim().min(1).max(200).optional(),
  description: Joi.string().allow('').max(4000).optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided' });

module.exports = {
  updateFinalHandoverSchema,
};
