const express = require("express");
const router = express.Router();
const { register, login, getMe } = require("../controllers/authController");
const validate = require("../middleware/validate");
const { auth } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");
const { registerSchema, loginSchema } = require("../validators/authValidator");

router.post("/register", authLimiter, validate(registerSchema), register);
router.post("/login", authLimiter, validate(loginSchema), login);
router.get("/me", auth, getMe);

// Optional: Logout. Usually handled purely client-side by deleting the JWT.
router.post("/logout", auth, (req, res) => {
  res.status(200).json({ status: "success", message: "Logged out successfully" });
});

module.exports = router;
