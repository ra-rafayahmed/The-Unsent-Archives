const express = require("express");
// mergeParams required because route will be mounted as /api/users/:id
const router = express.Router({ mergeParams: true });
const ctrl = require("../controllers/followController");
const { auth } = require("../middleware/auth");

router.post("/follow", auth, ctrl.followUser);
router.delete("/follow", auth, ctrl.unfollowUser);
router.get("/follow/status", auth, ctrl.getFollowStatus);
router.get("/followers", ctrl.getFollowers);
router.get("/following", ctrl.getFollowing);

module.exports = router;
