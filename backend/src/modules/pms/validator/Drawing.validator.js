const Joi = require('joi');

const OID = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

const DRAWING_TYPES = [
  'plan', 'elevation', 'civil', 'electrical', 'plumbing', 'technical_detail',
  'ac_coordination', 'automation', 'kitchen', 'bathroom', '3d_render',
  'concept', 'material_selection', 'site_photo', 'other',
];

const checklistSnapshotItem = Joi.object({
  item:        Joi.string().required(),
  isCompleted: Joi.boolean().optional(),
});

const uploadDrawingSchema = Joi.object({
  projectId:   OID.required().messages({ 'any.required': 'Project ID is required' }),
  taskId:      OID.allow('', null).optional(),
  title:       Joi.string().trim().min(1).max(200).required(),
  drawingType: Joi.string().valid(...DRAWING_TYPES).optional(),
  fileUrl:     Joi.string().uri().required().messages({ 'any.required': 'File URL is required' }),
  fileName:    Joi.string().optional(),
  fileType:    Joi.string().optional(),
  fileSize:    Joi.number().optional(),
  revisionNotes:     Joi.string().allow('').optional(),
  notes:             Joi.string().allow('').optional(),
  checklistSnapshot: Joi.array().items(checklistSnapshotItem).optional(),
});

const reviseDrawingSchema = Joi.object({
  fileUrl:           Joi.string().uri().required().messages({ 'any.required': 'New file URL is required' }),
  fileName:          Joi.string().optional(),
  fileType:          Joi.string().optional(),
  fileSize:          Joi.number().optional(),
  revisionNotes:     Joi.string().allow('').optional(),
  checklistSnapshot: Joi.array().items(checklistSnapshotItem).optional(),
});

const approveDrawingSchema = Joi.object({
  remarks: Joi.string().allow('').optional(),
});

const rejectDrawingSchema = Joi.object({
  rejectionReason: Joi.string().trim().min(3).required().messages({
    'any.required': 'Rejection reason is required',
    'string.min':   'Rejection reason must be at least 3 characters',
  }),
});

module.exports = {
  uploadDrawingSchema,
  reviseDrawingSchema,
  approveDrawingSchema,
  rejectDrawingSchema,
};
