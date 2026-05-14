const express = require("express");
const router = express.Router();
const { verifyToken, requireRole } = require("../../../middleware/auth.middleware");
const {
  getAllRoles,
  getRoleById,
  getAllPermissions,
  createRole,
  updateRole,
  deleteRole,
  getAllUsers,
  updateUserRole,
} = require("../controllers/Roles.controller");

// ─── All routes require authentication + admin role ───────────────────────────
router.use(verifyToken, requireRole("admin", "md"));

// ─── Static routes first (must come before /:id to avoid being swallowed) ─────
router.get("/permissions/all", getAllPermissions);
router.get("/users/list", getAllUsers);
router.patch("/users/:userId/role", requireRole("admin"), updateUserRole);

// ─── Role CRUD (dynamic :id segments last) ────────────────────────────────────
router.get("/", getAllRoles);
router.get("/:id", getRoleById);
router.post("/", requireRole("admin"), createRole);
router.put("/:id", requireRole("admin"), updateRole);
router.delete("/:id", requireRole("admin"), deleteRole);

module.exports = router;
