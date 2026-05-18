const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const {
  createSiteVisit,
  getProjectVisits,
  updateSiteVisit,
  deleteSiteVisit,
} = require("../controllers/SiteVisit.controller");

router.post("/create",                requirePermission("site_visits.create"), createSiteVisit);
router.get("/project/:projectId",     requirePermission("site_visits.read"),   getProjectVisits);
router.put("/update/:id",             requirePermission("site_visits.update"), updateSiteVisit);
router.delete("/delete/:id",          requirePermission("projects.delete"),    deleteSiteVisit);

module.exports = router;
