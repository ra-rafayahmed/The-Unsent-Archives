const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/followController");
const { auth } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { followSchema } = require("../validators/interactionValidator");

// Frontend-compatible global follows routes
router.post("/", auth, validate(followSchema), ctrl.followUserGlobal);
router.delete("/", auth, validate(followSchema), ctrl.unfollowUserGlobal);
router.get("/followers", auth, ctrl.getFollowersGlobal);
router.get("/following", auth, ctrl.getFollowingGlobal);

module.exports = router;
