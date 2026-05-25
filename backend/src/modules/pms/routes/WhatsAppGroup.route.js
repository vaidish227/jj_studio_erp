const express = require("express");
const router  = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const {
  createGroup,
  getGroupsByProject,
  getAllGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  addMember,
  removeMember,
  syncWithProvider,
  sendGroupUpdate,
} = require("../controllers/WhatsAppGroup.controller");

// ─── Static routes first (prevent shadowing by /:id) ──────────────────────────
router.get("/all",                    requirePermission("projects.read"),       getAllGroups);
router.post("/create",                requirePermission("pms.whatsapp.manage"), createGroup);
router.get("/project/:projectId",     requirePermission("projects.read"),       getGroupsByProject);

// ─── Single group ─────────────────────────────────────────────────────────────
router.get("/:id",                    requirePermission("projects.read"),       getGroupById);
router.put("/update/:id",             requirePermission("pms.whatsapp.manage"), updateGroup);
router.delete("/delete/:id",          requirePermission("pms.whatsapp.manage"), deleteGroup);

// ─── Member management ────────────────────────────────────────────────────────
router.post("/:id/members",           requirePermission("pms.whatsapp.manage"), addMember);
router.delete("/:id/members/:phone",  requirePermission("pms.whatsapp.manage"), removeMember);

// ─── Provider sync ────────────────────────────────────────────────────────────
router.post("/:id/sync",              requirePermission("pms.whatsapp.manage"), syncWithProvider);

// ─── Broadcast ────────────────────────────────────────────────────────────────
router.post("/send/:id",              requirePermission("pms.whatsapp.manage"), sendGroupUpdate);

module.exports = router;
