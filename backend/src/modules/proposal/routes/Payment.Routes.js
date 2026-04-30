const express = require("express");
const router = express.Router();

const {
  createPayment,
  updatePaymentStatus,
  getPaymentByProposal,
} = require("../controllers/payment.controller");


router.post("/create", createPayment);
router.put("/status/:id", updatePaymentStatus);
router.get("/get/:proposalId", getPaymentByProposal);

module.exports = router;