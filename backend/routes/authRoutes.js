const express = require("express");
const router = express.Router();
const {
  register,
  login,
  getMe,
  forgotPassword,
  resetPassword,
  recoverWithBackupCode,
  regenerateBackupCodes,
  getBackupCodeStatus,
} = require("../controllers/authController");
const validate = require("../middleware/validate");
const { auth } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");
const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  recoverWithBackupCodeSchema,
} = require("../validators/authValidator");

router.post("/register", authLimiter, validate(registerSchema), register);
router.post("/login", authLimiter, validate(loginSchema), login);
router.post(
  "/forgot-password",
  authLimiter,
  validate(forgotPasswordSchema),
  forgotPassword
);
router.post(
  "/reset-password",
  authLimiter,
  validate(resetPasswordSchema),
  resetPassword
);
router.post(
  "/recover",
  authLimiter,
  validate(recoverWithBackupCodeSchema),
  recoverWithBackupCode
);

router.get("/me", auth, getMe);
router.get("/backup-codes", auth, getBackupCodeStatus);
router.post("/backup-codes/regenerate", auth, regenerateBackupCodes);

// Optional: Logout. Usually handled purely client-side by deleting the JWT.
router.post("/logout", auth, (req, res) => {
  res.status(200).json({ status: "success", message: "Logged out successfully" });
});

module.exports = router;
