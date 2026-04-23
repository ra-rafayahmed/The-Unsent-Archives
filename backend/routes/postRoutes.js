const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/postController");
const validate = require("../middleware/validate");
const { auth } = require("../middleware/auth");
const { optionalAuth } = require("../middleware/optionalAuth");
const { createPostSchema, updatePostSchema } = require("../validators/postValidator");

// Reaction routes (nesting reactions under /posts/:id/reactions)
const reactionRoutes = require("./reactionRoutes");

// Base Routes
router.post("/", auth, validate(createPostSchema), ctrl.createPost);
router.get("/:id", optionalAuth, ctrl.getPost);
router.put("/:id", auth, validate(updatePostSchema), ctrl.updatePost);
router.delete("/:id", auth, ctrl.deletePost);

// Interactions
router.post("/:id/repost", auth, ctrl.repost);
router.post("/:id/comments", auth, ctrl.addComment);
router.delete("/:id/comments/:commentId", auth, ctrl.deleteComment);

// Mount reaction routes
router.use("/:id/reactions", reactionRoutes);

module.exports = router;
