const Joi = require("joi");

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const changePasswordSchema = Joi.object({
   userId: Joi.string().required(),
  oldPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
});

const signupSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  phone: Joi.string().allow('', null),
  role: Joi.string().valid("admin", "md", "manager", "sales", "accounts", "designer", "supervisor", "vendor", "client", "mis", "marketing", "hr").default("sales"),
});

module.exports = { loginSchema, signupSchema, changePasswordSchema };