const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/analyticsController");
const { auth } = require("../middleware/auth");
const { optionalAuth } = require("../middleware/optionalAuth");
const validate = require("../middleware/validate");
const { analyticsEventSchema } = require("../validators/interactionValidator");

router.post("/events", optionalAuth, validate(analyticsEventSchema), ctrl.logEvent);

// The getPostAnalytics and getUserAnalytics are logically sub-resources to posts and users.
// We can mount them here directly but use full paths, OR define them here and mount at root level.
// Here we define the direct routes since they were not defined in postRoutes or userRoutes.

router.get("/posts/:id/analytics", auth, ctrl.getPostAnalytics);
router.get("/users/:id/analytics", auth, ctrl.getUserAnalytics);

module.exports = router;
