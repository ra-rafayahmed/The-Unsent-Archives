const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/adminAuth");
const validate = require("../middleware/validate");
const { suspendUserSchema, setRoleSchema } = require("../validators/interactionValidator");
const ctrl = require("../controllers/adminController");

router.use(auth, requireAdmin);

router.get("/users", ctrl.listUsers);
router.get("/posts", ctrl.listPosts);
router.get("/reports", ctrl.listReports);

router.put("/users/:id/role", validate(setRoleSchema), ctrl.setUserRole);
router.put("/users/:id/suspend", validate(suspendUserSchema), ctrl.suspendUser);
router.post("/users/:id/issue-reset", ctrl.issueResetToken);
router.delete("/users/:id", ctrl.deleteUserAsAdmin);

router.delete("/posts/:id", ctrl.deletePostAsAdmin);

router.put("/reports/:id/resolve", ctrl.resolveReport);

module.exports = router;
