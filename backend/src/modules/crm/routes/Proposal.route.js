const express = require("express");
const router = express.Router();

const { createProposal , getProposals, updateProposalStatus, deleteProposal , getProposalById, updateProposal} = require("../controllers/Proposal.controller");

router.post("/create", createProposal );
router.get("/get", getProposals);
router.patch("/updatestatus/:id", updateProposalStatus);
router.delete("/delete/:id", deleteProposal);
router.get("/get/:id", getProposalById);
router.put("/update/:id",updateProposal)

module.exports = router;
