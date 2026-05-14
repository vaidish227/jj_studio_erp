const express = require("express");
const router = express.Router();
const {
  createSiteVisit,
  getProjectVisits,
  updateSiteVisit,
  deleteSiteVisit,
} = require("../controllers/SiteVisit.controller");

// Record Site Visit
router.post("/create", createSiteVisit);

// Get Visits by Project
router.get("/project/:projectId", getProjectVisits);

// Update Visit
router.put("/update/:id", updateSiteVisit);

// Delete Visit
router.delete("/delete/:id", deleteSiteVisit);

module.exports = router;
