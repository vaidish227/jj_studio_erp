const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const {
  createGroup,
  getGroupsByProject,
  updateGroup,
  deleteGroup,
  sendGroupUpdate,
} = require("../controllers/WhatsAppGroup.controller");

router.post("/create",              requirePermission("pms.whatsapp.manage"), createGroup);
router.get("/project/:projectId",   requirePermission("projects.read"),       getGroupsByProject);
router.put("/update/:id",           requirePermission("pms.whatsapp.manage"), updateGroup);
router.delete("/delete/:id",        requirePermission("pms.whatsapp.manage"), deleteGroup);
router.post("/send/:id",            requirePermission("pms.whatsapp.manage"), sendGroupUpdate);

module.exports = router;
