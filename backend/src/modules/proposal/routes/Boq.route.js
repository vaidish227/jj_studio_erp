const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const { createBOQ, getAllBOQ, getBOQById, updateBOQ, deleteBOQ } = require("../controllers/Boq.controller");

router.get("/getBoq",        requirePermission("proposal.read"),   getAllBOQ);
router.get("/get",           requirePermission("proposal.read"),   getBOQById);
router.post("/createBoq",    requirePermission("proposal.update"), createBOQ);
router.put("/updateBoq/:id", requirePermission("proposal.update"), updateBOQ);
router.delete("/delete",     requirePermission("proposal.delete"), deleteBOQ);

module.exports = router;