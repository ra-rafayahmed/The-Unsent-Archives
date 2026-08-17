const Joi = require("joi");
const { objectId } = require("./commonValidator");

// Reaction types accepted by the Reaction model's enum.
const REACTION_TYPES = ["like", "love", "haha", "wow", "sad", "angry"];

const reactionSchema = Joi.object({
  type: Joi.string()
    .valid(...REACTION_TYPES)
    .required()
    .messages({ "any.only": `type must be one of: ${REACTION_TYPES.join(", ")}` }),
});

// DELETE may omit the type to remove whatever reaction the user left.
const removeReactionSchema = Joi.object({
  type: Joi.string()
    .valid(...REACTION_TYPES)
    .optional(),
});

const commentSchema = Joi.object({
  text: Joi.string().trim().min(1).max(1000).required().messages({
    "string.empty": "Comment text is required",
    "string.max": "A comment cannot be longer than 1000 characters",
  }),
  isAnonymous: Joi.boolean().default(false),
});

// The global /api/follows routes take the target in the body; the nested
// /api/users/:id/follow routes take it in the path, so the body is optional there.
const followSchema = Joi.object({
  followeeId: objectId.required().messages({ "any.required": "followeeId is required" }),
});

const reportSchema = Joi.object({
  targetType: Joi.string().valid("post", "user").required().messages({
    "any.only": "targetType must be 'post' or 'user'",
    "any.required": "targetType must be 'post' or 'user'",
  }),
  targetId: objectId.required().messages({ "any.required": "targetId is required" }),
  reason: Joi.string()
    .valid("spam", "harassment", "hate", "self-harm", "nsfw", "impersonation", "other")
    .required()
    .messages({ "any.only": "Invalid report reason", "any.required": "Invalid report reason" }),
  // The controller truncates to the model's 500-char cap, so a longer note is
  // accepted rather than rejected; this bound only keeps the payload sane.
  note: Joi.string().allow("").max(5000).optional(),
});

const analyticsEventSchema = Joi.object({
  postId: objectId.required().messages({
    "any.required": "postId and eventType/type are required",
  }),
  // The client may send either key; the controller normalises them.
  eventType: Joi.string().valid("view", "save", "share", "click", "report").optional(),
  type: Joi.string().valid("view", "save", "share", "click", "report").optional(),
  metadata: Joi.object().optional(),
})
  .or("eventType", "type")
  .messages({ "object.missing": "postId and eventType/type are required" });

const suspendUserSchema = Joi.object({
  suspended: Joi.boolean().required().messages({
    "any.required": "suspended must be true or false",
    "boolean.base": "suspended must be true or false",
  }),
});

const setRoleSchema = Joi.object({
  role: Joi.string().valid("user", "admin").required(),
});

const resolveReportSchema = Joi.object({
  action: Joi.string().valid("resolved", "dismissed").required().messages({
    "any.only": "action must be resolved or dismissed",
    "any.required": "action must be resolved or dismissed",
  }),
});

const addPostToCollectionSchema = Joi.object({
  postId: objectId.required().messages({ "any.required": "postId is required" }),
});

const repostSchema = Joi.object({
  content: Joi.string().allow("").max(5000).optional(),
  visibility: Joi.string().valid("public", "followers", "private", "anonymous").optional(),
  isAnonymous: Joi.boolean().optional(),
});

// Mirrors the User schema's own limits so oversized input is refused at the
// boundary rather than by Mongoose after the request is already in a handler.
const updateProfileSchema = Joi.object({
  bio: Joi.string().allow("").max(300).optional(),
  avatarUrl: Joi.string().allow("").max(2000).optional(),
  profile: Joi.object({
    displayName: Joi.string().allow("").max(50).optional(),
    location: Joi.string().allow("").max(100).optional(),
    website: Joi.string().allow("").max(200).optional(),
  }).optional(),
  tagInterests: Joi.array().items(objectId).max(50).optional(),
});

const refreshRecommendationsSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(50).optional(),
});

module.exports = {
  refreshRecommendationsSchema,
  resolveReportSchema,
  addPostToCollectionSchema,
  repostSchema,
  updateProfileSchema,
  REACTION_TYPES,
  reactionSchema,
  removeReactionSchema,
  commentSchema,
  followSchema,
  reportSchema,
  analyticsEventSchema,
  suspendUserSchema,
  setRoleSchema,
};
