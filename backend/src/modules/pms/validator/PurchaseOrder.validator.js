const Joi = require('joi');

const OID = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

const poItemSchema = Joi.object({
  description: Joi.string().trim().required(),
  quantity:    Joi.number().positive().required(),
  rate:        Joi.number().positive().required(),
  amount:      Joi.number().positive().optional(),
});

const createPOSchema = Joi.object({
  projectId:            OID.required().messages({ 'any.required': 'projectId is required' }),
  vendorId:             OID.required().messages({ 'any.required': 'vendorId is required' }),
  taskId:               OID.allow('', null).optional(),
  items:                Joi.array().items(poItemSchema).min(1).required(),
  totalAmount:          Joi.number().positive().required(),
  expectedDeliveryDate: Joi.date().optional(),
  deliveryLocation:     Joi.string().allow('').optional(),
  notes:                Joi.string().allow('').optional(),
});

const updatePOSchema = Joi.object({
  status:               Joi.string().valid('draft', 'sent_to_vendor', 'confirmed', 'delivered', 'cancelled').optional(),
  paymentStatus:        Joi.string().valid('unpaid', 'partially_paid', 'fully_paid').optional(),
  advancePaid:          Joi.number().min(0).optional(),
  expectedDeliveryDate: Joi.date().allow(null).optional(),
  actualDeliveryDate:   Joi.date().allow(null).optional(),
  deliveryLocation:     Joi.string().allow('').optional(),
  items:                Joi.array().items(poItemSchema).optional(),
  totalAmount:          Joi.number().positive().optional(),
  notes:                Joi.string().allow('').optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided' });

module.exports = { createPOSchema, updatePOSchema };
