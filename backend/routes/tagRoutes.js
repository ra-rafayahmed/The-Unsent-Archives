const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/tagController");
const { optionalAuth } = require("../middleware/optionalAuth");

router.get("/", ctrl.listTags);
router.get("/trending", ctrl.getTrending);
router.get("/:slug/posts", optionalAuth, ctrl.getPostsByTag);

module.exports = router;
