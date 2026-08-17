const express = require("express");
// mergeParams since mounted at /posts/:id/reactions
const router = express.Router({ mergeParams: true });
const ctrl = require("../controllers/reactionController");
const { auth } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { reactionSchema, removeReactionSchema } = require("../validators/interactionValidator");

router.post("/", auth, validate(reactionSchema), ctrl.addReaction);
router.delete("/", auth, validate(removeReactionSchema), ctrl.removeReaction);
router.get("/", ctrl.getReactions);

module.exports = router;
