const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const ctrl = require("../controllers/reportController");

router.get("/reasons", ctrl.listReasons);
router.post("/", auth, ctrl.createReport);

module.exports = router;
