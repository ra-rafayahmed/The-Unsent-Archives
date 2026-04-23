const ApiError = require("../utils/ApiError");

// Joi schema validation factory
const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  
  if (error) {
    // Format error message from Joi details
    const details = error.details.map((d) => d.message).join(", ");
    return next(new ApiError(400, `Validation failed: ${details}`));
  }
  
  next();
};

module.exports = validate;
