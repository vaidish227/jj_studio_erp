const express = require("express");
const router = express.Router();

const {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  dismissNotification,
} = require("../controllers/Notification.controller");

// All routes mounted under /api/notifications and protected by the global
// verifyToken middleware in app.js.

router.get("/", listNotifications);
router.get("/count", getUnreadCount);
router.patch("/read-all", markAllAsRead);
router.patch("/:id/read", markAsRead);
router.delete("/:id", dismissNotification);

module.exports = router;
