const Joi = require("joi");

const createPostSchema = Joi.object({
  content: Joi.string().min(1).max(5000).required(),
  visibility: Joi.string().valid("public", "followers", "private").default("public"),
  isAnonymous: Joi.boolean().default(false),
  style: Joi.object({
    font: Joi.string().default("sans-serif"),
    background: Joi.string().default("#ffffff"),
    textColor: Joi.string().default("#1a1a1a"),
  }).default({}),
  media: Joi.array().items(
    Joi.object({
      url: Joi.string().uri().required(),
      type: Joi.string().valid("image", "video", "audio").required(),
      mimeType: Joi.string().optional(),
      width: Joi.number().optional(),
      height: Joi.number().optional(),
    })
  ).default([]),
  tags: Joi.array().items(Joi.string().regex(/^[a-zA-Z0-9-]+$/).message("Tags can only contain alphanumeric characters and hyphens")).max(10).default([]),
});

const updatePostSchema = Joi.object({
  content: Joi.string().min(1).max(5000).optional(),
  visibility: Joi.string().valid("public", "followers", "private").optional(),
  isAnonymous: Joi.boolean().optional(),
  style: Joi.object({
    font: Joi.string().optional(),
    background: Joi.string().optional(),
    textColor: Joi.string().optional(),
  }).optional(),
  media: Joi.array().items(
    Joi.object({
      url: Joi.string().uri().required(),
      type: Joi.string().valid("image", "video", "audio").required(),
      mimeType: Joi.string().optional(),
      width: Joi.number().optional(),
      height: Joi.number().optional(),
    })
  ).optional(),
  tags: Joi.array().items(Joi.string().regex(/^[a-zA-Z0-9-]+$/)).max(10).optional(),
});

module.exports = {
  createPostSchema,
  updatePostSchema,
};
