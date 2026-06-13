const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");

const {
  createESign,
  signProposal,
  getESignByProposal,
} = require("../controllers/Esign.controller");


router.get("/:proposalId", requirePermission("proposal.read"),   getESignByProposal);
router.post("/create",     requirePermission("proposal.update"), createESign);
router.put("/sign/:id",    requirePermission("proposal.update"), signProposal);

module.exports = router;