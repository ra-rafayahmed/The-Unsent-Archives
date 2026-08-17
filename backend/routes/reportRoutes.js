const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { reportSchema } = require("../validators/interactionValidator");
const ctrl = require("../controllers/reportController");

router.get("/reasons", ctrl.listReasons);
router.post("/", auth, validate(reportSchema), ctrl.createReport);

module.exports = router;
