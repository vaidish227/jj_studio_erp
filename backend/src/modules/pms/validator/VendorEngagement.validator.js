const Joi = require("joi");

const OID = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

const VENDOR_KINDS = ["ac", "automation", "kitchen"];

const createEngagementSchema = Joi.object({
  projectId: OID.required(),
  vendorId:  OID.required(),
  vendorKind: Joi.string().valid(...VENDOR_KINDS).required(),
  taskId:    OID.allow("", null).optional(),
  notes:     Joi.string().allow("").optional(),
  // Auto-spawn the per-vendor WhatsApp group. Default true.
  createWhatsAppGroup: Joi.boolean().default(true),
});

const recordQuoteSchema = Joi.object({
  amount:       Joi.number().positive().required(),
  quotationUrl: Joi.string().uri().allow("").optional(),
  notes:        Joi.string().allow("").optional(),
});

const recordClientApprovalSchema = Joi.object({
  approvalId: OID.allow("", null).optional(),
  notes:      Joi.string().allow("").optional(),
});

const emitPOSchema = Joi.object({
  items: Joi.array().items(
    Joi.object({
      itemName:    Joi.string().required(),
      quantity:    Joi.number().positive().required(),
      unit:        Joi.string().default("unit"),
      rate:        Joi.number().positive().required(),
      amount:      Joi.number().optional(),
      description: Joi.string().allow("").optional(),
    })
  ).min(1).required(),
  expectedDeliveryDate: Joi.date().optional(),
  notes: Joi.string().allow("").optional(),
});

const recordDeliverySchema = Joi.object({
  actualDeliveryDate: Joi.date().optional(),
  notes: Joi.string().allow("").optional(),
});

const cancelEngagementSchema = Joi.object({
  reason: Joi.string().trim().min(3).required(),
});

module.exports = {
  createEngagementSchema,
  recordQuoteSchema,
  recordClientApprovalSchema,
  emitPOSchema,
  recordDeliverySchema,
  cancelEngagementSchema,
  VENDOR_KINDS,
};
