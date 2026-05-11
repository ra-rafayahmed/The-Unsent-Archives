const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const { uploadSingle } = require("../middleware/upload");
const ctrl = require("../controllers/uploadController");

router.post("/", auth, uploadSingle, ctrl.uploadMedia);
router.get("/my", auth, ctrl.listMyMedia);
router.get("/:id/file", ctrl.streamMedia);
router.delete("/:id", auth, ctrl.deleteMedia);

module.exports = router;
