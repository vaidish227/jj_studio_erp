const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const {
  createPO,
  getProjectPOs,
  updatePO,
  deletePO,
} = require("../controllers/PurchaseOrder.controller");
const { requireProjectActivityAllowed } = require("../middleware/gateEnforcement");

router.post(
  "/create",
  requirePermission("purchase_orders.create"),
  requireProjectActivityAllowed({
    activity: "po.emit",
    // PurchaseOrder.controller.createPO reads projectId from req.body — default resolver is fine.
  }),
  createPO
);
router.get("/project/:projectId", requirePermission("purchase_orders.read"),   getProjectPOs);
router.put("/update/:id",         requirePermission("purchase_orders.update"), updatePO);
router.delete("/delete/:id",      requirePermission("purchase_orders.update"), deletePO);

module.exports = router;
