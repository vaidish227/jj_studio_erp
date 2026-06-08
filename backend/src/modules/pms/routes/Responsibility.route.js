const express = require("express");
const router = express.Router();
const { requireRole } = require("../../../middleware/auth.middleware");
const {
  listResponsibilities,
  createResponsibility,
  updateResponsibility,
  deleteResponsibility,
} = require("../controllers/Responsibility.controller");

// verifyToken is applied globally in app.js — any authenticated user can list.
router.get("/all", listResponsibilities);

// Write — admin/md only
router.post("/create",       requireRole("admin", "md"), createResponsibility);
router.patch("/update/:id",  requireRole("admin", "md"), updateResponsibility);
router.delete("/delete/:id", requireRole("admin", "md"), deleteResponsibility);

module.exports = router;
