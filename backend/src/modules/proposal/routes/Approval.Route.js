const express = require("express");
const router = express.Router();
const { createApproval, updateApprovalStatus, getApprovalsByProposal} = require("../controllers/Approval.controller")

router.post("/create", createApproval);
router.patch("/update/:id", updateApprovalStatus);
router.get("/get/:proposalId", getApprovalsByProposal)


module.exports = router;