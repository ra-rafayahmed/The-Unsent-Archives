const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/userController");
const { auth } = require("../middleware/auth");
const { optionalAuth } = require("../middleware/optionalAuth");
const validate = require("../middleware/validate");
const { updateProfileSchema } = require("../validators/interactionValidator");

// User routes
router.get("/:id", ctrl.getProfile);
router.put("/:id", auth, validate(updateProfileSchema), ctrl.updateProfile);
router.get("/:id/posts", optionalAuth, ctrl.getUserPosts);
router.get("/:id/collections", optionalAuth, ctrl.getUserCollections);

// Mount follow routes
const followRoutes = require("./followRoutes");
router.use("/:id", followRoutes);

module.exports = router;
