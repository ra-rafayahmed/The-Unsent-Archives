const express = require("express");
// mergeParams since mounted at /posts/:id/reactions
const router = express.Router({ mergeParams: true });
const ctrl = require("../controllers/reactionController");
const { auth } = require("../middleware/auth");

router.post("/", auth, ctrl.addReaction);
router.delete("/", auth, ctrl.removeReaction);
router.get("/", ctrl.getReactions);

module.exports = router;
