const express = require("express");
const router = express.Router();

const {
  createActivity,
  getActivitiesByProposal,
} = require("../controllers/Activity.controller");


router.post("/create", createActivity);
router.get("/:proposalId", getActivitiesByProposal);

module.exports = router;