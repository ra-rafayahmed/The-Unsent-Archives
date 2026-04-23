const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/feedController");
const { auth } = require("../middleware/auth");
const { optionalAuth } = require("../middleware/optionalAuth");

router.get("/", optionalAuth, ctrl.getExplore);
router.get("/following", auth, ctrl.getFollowingFeed);
router.get("/trending", optionalAuth, ctrl.getTrending);

module.exports = router;
