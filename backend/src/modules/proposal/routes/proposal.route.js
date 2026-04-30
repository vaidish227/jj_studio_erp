const express = require("express");
const {
  createTemplate,
  getTemplates,
  updateTemplate,
  createProposal,
  getProposals,
  getProposalById,
  updateStatus,
  approveOrReject,
  sendProposal,
  recordESign,
  recordPayment,
  getDashboardSummary,
  deleteProposal,
} = require("../controllers/proposal.controller");

const router = express.Router();

router.post("/templates", createTemplate);
router.get("/templates", getTemplates);
router.put("/templates/:id", updateTemplate);

router.post("/", createProposal);
router.get("/", getProposals);
router.get("/dashboard/summary", getDashboardSummary);
router.get("/:id", getProposalById);
router.patch("/:id/status", updateStatus);
router.post("/:id/approval", approveOrReject);
router.post("/:id/send", sendProposal);
router.post("/:id/esign", recordESign);
router.post("/:id/payment", recordPayment);
router.delete("/:id", deleteProposal);

module.exports = router;
