const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const {
  createVendor,
  getAllVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
} = require("../controllers/Vendor.controller");

router.get("/all",         requirePermission("vendor.read"),   getAllVendors);
router.get("/:id",         requirePermission("vendor.read"),   getVendorById);
router.post("/create",     requirePermission("vendor.create"), createVendor);
router.put("/update/:id",  requirePermission("vendor.update"), updateVendor);
router.delete("/delete/:id", requirePermission("vendor.update"), deleteVendor);

module.exports = router;
