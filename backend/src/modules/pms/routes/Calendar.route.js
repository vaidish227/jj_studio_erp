const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const { getCalendarEvents } = require("../controllers/Calendar.controller");

router.get("/events", requirePermission("calendar.read"), getCalendarEvents);

module.exports = router;
