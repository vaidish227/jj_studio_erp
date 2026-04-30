const express = require("express");
const router = express.Router();

const {
  createESign,
  signProposal,
  getESignByProposal,
} = require("../controllers/Esign.controller");


router.post("/create", createESign);
router.put("/sign/:id", signProposal);
router.get("/:proposalId", getESignByProposal);

module.exports = router;