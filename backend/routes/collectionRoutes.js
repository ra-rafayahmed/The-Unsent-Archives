const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/collectionController");
const validate = require("../middleware/validate");
const { auth } = require("../middleware/auth");
const { optionalAuth } = require("../middleware/optionalAuth");
const {
  createCollectionSchema,
  updateCollectionSchema,
} = require("../validators/collectionValidator");
const { addPostToCollectionSchema } = require("../validators/interactionValidator");

router.post("/", auth, validate(createCollectionSchema), ctrl.createCollection);
router.get("/:id", optionalAuth, ctrl.getCollection);
router.put("/:id", auth, validate(updateCollectionSchema), ctrl.updateCollection);
router.delete("/:id", auth, ctrl.deleteCollection);

router.post("/:id/posts", auth, validate(addPostToCollectionSchema), ctrl.addPost);
router.delete("/:id/posts/:postId", auth, ctrl.removePost);

module.exports = router;
