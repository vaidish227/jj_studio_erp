const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");

const {
  createActivity,
  getActivitiesByProposal,
} = require("../controllers/Activity.controller");


router.get("/:proposalId", requirePermission("proposal.read"),   getActivitiesByProposal);
router.post("/create",     requirePermission("proposal.update"), createActivity);

module.exports = router;