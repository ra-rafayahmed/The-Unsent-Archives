const jwt = require("jsonwebtoken");
const { User } = require("../models");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const config = require("../config");

// Generate JWT Helper
const generateToken = (id, username, email) => {
  return jwt.sign({ id, username, email }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const register = asyncHandler(async (req, res, next) => {
  const { username, email, password } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (existingUser) {
    if (existingUser.email === email) {
      return next(new ApiError(409, "Email is already registered"));
    }
    return next(new ApiError(409, "Username is already taken"));
  }

  // Create user
  const user = await User.create({
    username,
    email,
    passwordHash: password, // handled by pre-save hook
  });

  const token = generateToken(user._id, user.username, user.email);

  res.status(201).json({
    status: "success",
    token,
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
    },
  });
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Find user and explicitly select passwordHash
  const user = await User.findOne({ email }).select("+passwordHash");
  
  if (!user || !(await user.comparePassword(password))) {
    return next(new ApiError(401, "Invalid email or password"));
  }

  if (!user.isActive) {
    return next(new ApiError(403, "This account has been deactivated"));
  }

  const token = generateToken(user._id, user.username, user.email);

  res.status(200).json({
    status: "success",
    token,
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
    },
  });
});

// @desc    Get current logged in user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).populate("tagInterests", "name slug");
  
  if (!user) {
    return next(new ApiError(404, "User not found"));
  }

  res.status(200).json({
    status: "success",
    user,
  });
});

module.exports = {
  register,
  login,
  getMe,
};
