const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/followController");
const { auth } = require("../middleware/auth");

// Frontend-compatible global follows routes
router.post("/", auth, ctrl.followUserGlobal);
router.delete("/", auth, ctrl.unfollowUserGlobal);
router.get("/followers", auth, ctrl.getFollowersGlobal);
router.get("/following", auth, ctrl.getFollowingGlobal);

module.exports = router;
