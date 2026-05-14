const express = require("express");
const router = express.Router();
const {
  createVendor,
  getAllVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
} = require("../controllers/Vendor.controller");

// Create Vendor
router.post("/create", createVendor);

// Get All Vendors
router.get("/all", getAllVendors);

// Get Single Vendor
router.get("/:id", getVendorById);

// Update Vendor
router.put("/update/:id", updateVendor);

// Delete Vendor
router.delete("/delete/:id", deleteVendor);

module.exports = router;
