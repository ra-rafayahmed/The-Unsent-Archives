const express = require("express");
const router = express.Router();

router.use("/health", require("./healthRoutes"));
router.use("/auth", require("./authRoutes"));
router.use("/users", require("./userRoutes"));
router.use("/posts", require("./postRoutes"));
router.use("/collections", require("./collectionRoutes"));
router.use("/tags", require("./tagRoutes"));
router.use("/feed", require("./feedRoutes"));
router.use("/search", require("./searchRoutes"));
router.use("/follows", require("./followsRoutes"));
router.use("/uploads", require("./uploadRoutes"));
router.use("/reports", require("./reportRoutes"));
router.use("/recommendations", require("./recommendationRoutes"));
router.use("/admin", require("./adminRoutes"));
// Special mount for analytics because it has internal full paths like /posts/:id/analytics
router.use("/", require("./analyticsRoutes"));

module.exports = router;
