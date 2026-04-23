const Joi = require("joi");

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const objectId = Joi.string().regex(objectIdPattern).message("Invalid ID format");

const pagination = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  objectId,
  pagination,
  objectIdPattern
};
