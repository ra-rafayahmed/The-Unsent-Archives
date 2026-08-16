const Joi = require("joi");

const createPostSchema = Joi.object({
  content: Joi.string().min(1).max(5000).required(),
  visibility: Joi.string().valid("public", "followers", "private", "anonymous").default("public"),
  isAnonymous: Joi.boolean().default(false),
  style: Joi.object({
    font: Joi.string().default("sans-serif"),
    background: Joi.string().default("#ffffff"),
    textColor: Joi.string().default("#1a1a1a"),
    fontSize: Joi.number().min(0.8).max(2.4).default(1.15),
    lineHeight: Joi.number().min(1).max(2.4).default(1.6),
    letterSpacing: Joi.number().min(-0.03).max(0.2).default(0),
    textAlign: Joi.string().valid("left", "center", "right", "justify").default("center"),
  }).default({}),
  media: Joi.array()
    .items(
      Joi.object({
        url: Joi.string().uri().required(),
        type: Joi.string().valid("image", "video", "audio").required(),
        mimeType: Joi.string().optional(),
        width: Joi.number().optional(),
        height: Joi.number().optional(),
      })
    )
    .default([]),
  tags: Joi.array()
    .items(
      Joi.string()
        .regex(/^[a-zA-Z0-9-]+$/)
        .message("Tags can only contain alphanumeric characters and hyphens")
    )
    .max(10)
    .default([]),
  tagSlugs: Joi.array()
    .items(
      Joi.string()
        .regex(/^[a-zA-Z0-9-]+$/)
        .message("Tag slugs can only contain alphanumeric characters and hyphens")
    )
    .max(10)
    .optional(),
});

const updatePostSchema = Joi.object({
  content: Joi.string().min(1).max(5000).optional(),
  visibility: Joi.string().valid("public", "followers", "private", "anonymous").optional(),
  isAnonymous: Joi.boolean().optional(),
  style: Joi.object({
    font: Joi.string().optional(),
    background: Joi.string().optional(),
    textColor: Joi.string().optional(),
    fontSize: Joi.number().min(0.8).max(2.4).optional(),
    lineHeight: Joi.number().min(1).max(2.4).optional(),
    letterSpacing: Joi.number().min(-0.03).max(0.2).optional(),
    textAlign: Joi.string().valid("left", "center", "right", "justify").optional(),
  }).optional(),
  media: Joi.array()
    .items(
      Joi.object({
        url: Joi.string().uri().required(),
        type: Joi.string().valid("image", "video", "audio").required(),
        mimeType: Joi.string().optional(),
        width: Joi.number().optional(),
        height: Joi.number().optional(),
      })
    )
    .optional(),
  tags: Joi.array()
    .items(Joi.string().regex(/^[a-zA-Z0-9-]+$/))
    .max(10)
    .optional(),
  tagSlugs: Joi.array()
    .items(Joi.string().regex(/^[a-zA-Z0-9-]+$/))
    .max(10)
    .optional(),
});

module.exports = {
  createPostSchema,
  updatePostSchema,
};
