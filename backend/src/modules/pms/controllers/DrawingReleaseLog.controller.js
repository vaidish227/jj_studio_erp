/**
 * DrawingReleaseLog.controller — Phase 2.
 *
 * Read + ack endpoints. The release log is WRITTEN as a side-effect of
 * Drawing.controller.releaseDrawing via writeReleaseLog().
 */

const mongoose = require("mongoose");
const DrawingReleaseLog = require("../models/DrawingReleaseLog.model");
const Drawing = require("../models/Drawing.model");
const Project = require("../models/Project.model");
const WhatsAppProjectGroup = require("../models/WhatsAppProjectGroup.model");
const { logActivity } = require("../../../shared/activityLogger");

/**
 * @route GET /api/pms/drawing/:id/release-log
 * Returns all release log entries for a drawing (newest first).
 */
const getReleaseLog = async (req, res) => {
  try {
    const logs = await DrawingReleaseLog.find({ drawingId: req.params.id })
      .populate("releasedBy", "name email")
      .populate("recipients.userId", "name email")
      .sort({ releasedAt: -1 })
      .lean();
    res.json({ count: logs.length, logs });
  } catch (err) {
    console.error("[getReleaseLog]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route POST /api/pms/drawing/release-log/:logId/ack
 * Body: { recipientId?, notes? }
 *
 * Marks a recipient as having acknowledged the release.
 * If recipientId is omitted, marks all entries matching req.user._id.
 */
const ackReleaseLog = async (req, res) => {
  try {
    const { recipientId, notes } = req.body || {};
    const log = await DrawingReleaseLog.findById(req.params.logId);
    if (!log) return res.status(404).json({ message: "Release log not found" });

    let matched = 0;
    for (const r of log.recipients) {
      if (r.ackedAt) continue;
      const matchesId = recipientId && String(r._id) === String(recipientId);
      const matchesUser = !recipientId && r.userId && String(r.userId) === String(req.user._id);
      if (matchesId || matchesUser) {
        r.ackedAt = new Date();
        r.ackedBy = req.user._id;
        r.ackNotes = notes || r.ackNotes;
        matched++;
      }
    }

    if (matched === 0) {
      return res.status(404).json({ message: "No matching recipient to acknowledge" });
    }
    await log.save();

    try {
      await logActivity({
        projectId: log.projectId,
        actorId: req.user._id,
        entityType: "drawing",
        entityId: log.drawingId,
        action: "updated",
        description: `Drawing release acknowledged (${matched} recipient(s))`,
      });
    } catch (e) { /* best-effort */ }

    res.json({ message: "Release acknowledged", log, acked: matched });
  } catch (err) {
    console.error("[ackReleaseLog]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * writeReleaseLog — internal helper, called by Drawing.controller.releaseDrawing.
 * Builds recipient list from supervisor + drawing-group members and persists the log.
 * Returns the created log doc (or null on failure — never throws).
 */
async function writeReleaseLog({ drawing, releasedBy, extraRecipients = [] }) {
  try {
    const project = await Project.findById(drawing.projectId)
      .select("supervisor")
      .populate("supervisor", "name email phone")
      .lean();

    const drawingGroup = await WhatsAppProjectGroup.findOne({
      projectId: drawing.projectId,
      groupType: "drawing",
    })
      .populate("members.userId", "name email phone")
      .lean();

    const recipients = [];
    if (project?.supervisor) {
      recipients.push({
        userId: project.supervisor._id,
        name: project.supervisor.name,
        email: project.supervisor.email,
        phone: project.supervisor.phone,
        channel: "in_app",
      });
    }
    if (drawingGroup?.members?.length) {
      for (const m of drawingGroup.members) {
        recipients.push({
          userId: m.userId?._id || m.userId || null,
          name: m.name || m.userId?.name,
          email: m.userId?.email,
          phone: m.phone || m.userId?.phone,
          channel: "whatsapp",
        });
      }
    }
    for (const r of extraRecipients) recipients.push(r);

    // Deduplicate by phone/email
    const seen = new Set();
    const dedup = recipients.filter((r) => {
      const key = `${r.userId || ""}|${r.phone || ""}|${r.email || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const log = await DrawingReleaseLog.create({
      drawingId:  drawing._id,
      projectId:  drawing.projectId,
      releasedBy,
      releasedAt: drawing.releasedAt || new Date(),
      version:    drawing.version,
      title:      drawing.title,
      recipients: dedup,
    });
    return log;
  } catch (err) {
    console.warn("[writeReleaseLog]", err.message);
    return null;
  }
}

module.exports = {
  getReleaseLog,
  ackReleaseLog,
  writeReleaseLog,
};
