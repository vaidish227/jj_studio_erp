const express = require("express");
const router = express.Router();
const {
  createPO,
  getProjectPOs,
  updatePO,
  deletePO,
} = require("../controllers/PurchaseOrder.controller");

// Create PO
router.post("/create", createPO);

// Get POs by Project
router.get("/project/:projectId", getProjectPOs);

// Update PO
router.put("/update/:id", updatePO);

// Delete PO
router.delete("/delete/:id", deletePO);

module.exports = router;
