const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");

const {
  createPayment,
  updatePaymentStatus,
  getPaymentByProposal,
} = require("../controllers/payment.controller");


router.get("/get/:proposalId", requirePermission("proposal.read"),   getPaymentByProposal);
router.post("/create",         requirePermission("proposal.update"), createPayment);
router.put("/status/:id",      requirePermission("proposal.update"), updatePaymentStatus);

module.exports = router;