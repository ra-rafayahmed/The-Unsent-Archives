const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { User } = require("../models");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const config = require("../config");

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const BACKUP_CODE_COUNT = 8;

const hashResetToken = (rawToken) =>
  crypto.createHash("sha256").update(rawToken).digest("hex");

const hashBackupCode = (raw) =>
  crypto.createHash("sha256").update(raw.toLowerCase().replace(/-/g, "")).digest("hex");

// Generate human-friendly backup codes like "a3f9-7b2k-4mw2".
const generateBackupCode = () => {
  const raw = crypto.randomBytes(6).toString("hex"); // 12 hex chars
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
};

const buildBackupCodeSet = () => {
  const codes = Array.from({ length: BACKUP_CODE_COUNT }, generateBackupCode);
  const docs = codes.map((c) => ({ codeHash: hashBackupCode(c), used: false }));
  return { codes, docs };
};

// Generate JWT Helper
const generateToken = (id, username, email, role) => {
  return jwt.sign({ id, username, email, role }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const register = asyncHandler(async (req, res, next) => {
  const { username, email, password } = req.body;
  const normalizedEmail = email.toLowerCase();

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ email: normalizedEmail }, { username }],
  });

  if (existingUser) {
    if (existingUser.email === normalizedEmail) {
      return next(new ApiError(409, "Email is already registered"));
    }
    return next(new ApiError(409, "Username is already taken"));
  }

  const shouldBeAdmin = Array.isArray(config.adminEmails)
    ? config.adminEmails.includes(normalizedEmail)
    : false;

  const { codes: backupCodes, docs: backupDocs } = buildBackupCodeSet();

  // Create user
  const user = await User.create({
    username,
    email: normalizedEmail,
    role: shouldBeAdmin ? "admin" : "user",
    passwordHash: password, // handled by pre-save hook
    backupCodes: backupDocs,
  });

  const token = generateToken(user._id, user.username, user.email, user.role);

  res.status(201).json({
    status: "success",
    token,
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
    },
    // One-time return of plaintext recovery codes. The user must save these now.
    backupCodes,
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

  if (!user.isActive || user.isSuspended) {
    return next(new ApiError(403, user.isSuspended
      ? "This account has been suspended"
      : "This account has been deactivated"));
  }

  const token = generateToken(user._id, user.username, user.email, user.role);

  res.status(200).json({
    status: "success",
    token,
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
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

// @desc    Request a password reset link
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;
  const normalizedEmail = email.toLowerCase();

  const user = await User.findOne({ email: normalizedEmail });

  // Always respond the same way to avoid leaking which emails are registered.
  const genericResponse = {
    status: "success",
    message:
      "If an account exists for that email, a reset link has been generated.",
  };

  if (!user || !user.isActive) {
    return res.status(200).json(genericResponse);
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  user.passwordResetTokenHash = hashResetToken(rawToken);
  user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await user.save({ validateBeforeSave: false });

  // No mail server is wired up yet. To keep recovery functional we expose the
  // reset link in non-production environments so the user can complete the flow.
  // In production this should be sent via email instead.
  const responsePayload = { ...genericResponse };
  if (config.env !== "production") {
    responsePayload.resetToken = rawToken;
    responsePayload.email = user.email;
    responsePayload.expiresAt = user.passwordResetExpires;
  }

  res.status(200).json(responsePayload);
});

// @desc    Complete a password reset using a token
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = asyncHandler(async (req, res, next) => {
  const { token, password } = req.body;

  const tokenHash = hashResetToken(token);

  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  }).select("+passwordHash +passwordResetTokenHash +passwordResetExpires");

  if (!user) {
    return next(new ApiError(400, "This reset link is invalid or has expired"));
  }

  user.passwordHash = password; // re-hashed by pre-save hook
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  const authToken = generateToken(user._id, user.username, user.email, user.role);

  res.status(200).json({
    status: "success",
    message: "Password has been reset",
    token: authToken,
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
    },
  });
});

// @desc    Recover account using a one-time backup code
// @route   POST /api/auth/recover
// @access  Public
const recoverWithBackupCode = asyncHandler(async (req, res, next) => {
  const { email, code, password } = req.body;
  const normalizedEmail = String(email || "").toLowerCase();
  const normalizedCode = String(code || "").trim();

  if (!normalizedEmail || !normalizedCode || !password) {
    return next(new ApiError(400, "Email, backup code, and new password are required"));
  }
  if (String(password).length < 6) {
    return next(new ApiError(400, "Password must be at least 6 characters"));
  }

  const user = await User.findOne({ email: normalizedEmail }).select("+passwordHash +backupCodes");

  if (!user || !user.isActive) {
    return next(new ApiError(400, "Invalid email or backup code"));
  }

  const target = hashBackupCode(normalizedCode);
  const match = user.backupCodes.find((c) => c.codeHash === target && !c.used);

  if (!match) {
    return next(new ApiError(400, "Invalid email or backup code"));
  }

  match.used = true;
  match.usedAt = new Date();
  user.passwordHash = password; // re-hashed by pre-save hook
  await user.save();

  const token = generateToken(user._id, user.username, user.email, user.role);

  res.status(200).json({
    status: "success",
    message: "Account recovered with backup code",
    token,
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
    },
  });
});

// @desc    Replace user's backup codes (signed-in users only)
// @route   POST /api/auth/backup-codes/regenerate
// @access  Private
const regenerateBackupCodes = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select("+backupCodes");
  const { codes, docs } = buildBackupCodeSet();
  user.backupCodes = docs;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    backupCodes: codes,
  });
});

// @desc    Summary of how many unused backup codes the user still has
// @route   GET /api/auth/backup-codes
// @access  Private
const getBackupCodeStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select("+backupCodes");
  const total = user.backupCodes.length;
  const remaining = user.backupCodes.filter((c) => !c.used).length;

  res.status(200).json({
    status: "success",
    total,
    remaining,
    used: total - remaining,
  });
});

module.exports = {
  register,
  login,
  getMe,
  forgotPassword,
  resetPassword,
  recoverWithBackupCode,
  regenerateBackupCodes,
  getBackupCodeStatus,
  // exposed for admin controller
  hashResetToken,
  RESET_TOKEN_TTL_MS,
};
