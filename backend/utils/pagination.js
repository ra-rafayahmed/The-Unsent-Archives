// Reusable pagination logic
const getPagination = (pageStr, limitStr, defaultLimit = 20, maxLimit = 100) => {
  const page = parseInt(pageStr, 10) || 1;
  let limit = parseInt(limitStr, 10) || defaultLimit;
  
  if (limit > maxLimit) {
    limit = maxLimit;
  }
  
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

module.exports = {
  getPagination
};
