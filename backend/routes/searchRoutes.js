const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/searchController");
const { optionalAuth } = require("../middleware/optionalAuth");

router.get("/", optionalAuth, ctrl.search);

module.exports = router;
