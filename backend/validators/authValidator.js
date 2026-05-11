const Joi = require("joi");

const registerSchema = Joi.object({
  username: Joi.string().min(3).max(30).pattern(/^[a-zA-Z0-9_]+$/).required().messages({
    "string.pattern.base": "Username can only contain letters, numbers, and underscores",
  }),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().min(20).required(),
  password: Joi.string().min(6).required(),
});

const recoverWithBackupCodeSchema = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().min(6).required(),
  password: Joi.string().min(6).required(),
});

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  recoverWithBackupCodeSchema,
};
