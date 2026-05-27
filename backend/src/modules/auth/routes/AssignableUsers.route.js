const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const { getAssignableUsers, updateUserContact } = require("../controllers/AssignableUsers.controller");

// GET /api/pms/users/assignable
router.get("/assignable", requirePermission("projects.read"), getAssignableUsers);

// PATCH /api/pms/users/:userId/contact  — update email/phone when missing
router.patch("/:userId/contact", requirePermission("projects.read"), updateUserContact);

module.exports = router;
