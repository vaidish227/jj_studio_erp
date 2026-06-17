const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const {
  listDepartments,
  createDepartment,
  updateDepartment,
  removeDepartment,
} = require("../controllers/department.controller");

// verifyToken is applied globally in app.js.
// Read — any user who can view delegations (drives the create-delegation dropdown).
router.get("/", requirePermission("delegation.read"), listDepartments);

// Write — admins/MD (delegation.department.manage). Admin holds '*' implicitly.
router.post("/", requirePermission("delegation.department.manage"), createDepartment);
router.patch("/:id", requirePermission("delegation.department.manage"), updateDepartment);
router.delete("/:id", requirePermission("delegation.department.manage"), removeDepartment);

module.exports = router;
