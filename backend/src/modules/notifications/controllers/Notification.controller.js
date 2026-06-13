const mongoose = require("mongoose");
const Notification = require("../models/Notification.model");

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const currentUserId = (req) => req.user?.id || req.user?._id;

// =====================================================================
//  GET /api/notifications — paginated list for the current user
//  Query: ?unreadOnly=true&module=crm&limit=20&skip=0
// =====================================================================
const listNotifications = async (req, res) => {
  try {
    const userId = currentUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);
    const unreadOnly = req.query.unreadOnly === "true";
    const moduleFilter = req.query.module ? String(req.query.module) : null;

    const filter = { recipientId: userId };
    if (unreadOnly) filter.readAt = null;
    if (moduleFilter) filter.module = moduleFilter;

    const [items, total, unread] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipientId: userId, readAt: null }),
    ]);

    res.status(200).json({
      items,
      total,
      unread,
      limit,
      skip,
    });
  } catch (err) {
    console.error("listNotifications error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

// =====================================================================
//  GET /api/notifications/count — unread badge counter
// =====================================================================
const getUnreadCount = async (req, res) => {
  try {
    const userId = currentUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const unread = await Notification.countDocuments({
      recipientId: userId,
      readAt: null,
    });
    res.status(200).json({ unread });
  } catch (err) {
    console.error("getUnreadCount error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

// =====================================================================
//  PATCH /api/notifications/:id/read — mark a single notification read
// =====================================================================
const markAsRead = async (req, res) => {
  try {
    const userId = currentUserId(req);
    const { id } = req.params;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid notification id" });

    const updated = await Notification.findOneAndUpdate(
      { _id: id, recipientId: userId },
      { $set: { readAt: new Date() } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Notification not found" });

    res.status(200).json({ notification: updated });
  } catch (err) {
    console.error("markAsRead error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

// =====================================================================
//  PATCH /api/notifications/read-all — mark every unread read for me
// =====================================================================
const markAllAsRead = async (req, res) => {
  try {
    const userId = currentUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const result = await Notification.updateMany(
      { recipientId: userId, readAt: null },
      { $set: { readAt: new Date() } }
    );

    res.status(200).json({ modified: result.modifiedCount || 0 });
  } catch (err) {
    console.error("markAllAsRead error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

// =====================================================================
//  DELETE /api/notifications/:id — dismiss / hide
// =====================================================================
const dismissNotification = async (req, res) => {
  try {
    const userId = currentUserId(req);
    const { id } = req.params;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid notification id" });

    const deleted = await Notification.findOneAndDelete({ _id: id, recipientId: userId });
    if (!deleted) return res.status(404).json({ message: "Notification not found" });

    res.status(200).json({ message: "Notification dismissed" });
  } catch (err) {
    console.error("dismissNotification error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  dismissNotification,
};
