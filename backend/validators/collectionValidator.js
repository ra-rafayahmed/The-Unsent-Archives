const Joi = require("joi");

const createCollectionSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).allow("").optional(),
  visibility: Joi.string().valid("public", "private").default("private"),
});

const updateCollectionSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  description: Joi.string().max(500).allow("").optional(),
  visibility: Joi.string().valid("public", "private").optional(),
});

module.exports = {
  createCollectionSchema,
  updateCollectionSchema,
};
