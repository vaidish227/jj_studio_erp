const mongoose = require("mongoose");

/**
 * DrawingReleaseLog — Phase 2.
 * Captures who a drawing was released TO and whether they have acknowledged it.
 *
 * One log per release event. A new release (re-release after revision) creates a new log.
 *
 * Created automatically by Drawing.controller.releaseDrawing.
 * Recipients are sourced from:
 *   - Project.supervisor (always)
 *   - Members of the project's "drawing" WhatsAppProjectGroup, if it exists
 *   - Any explicit recipientIds passed at release time
 */

const recipientSchema = new mongoose.Schema(
  {
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name:    String,
    phone:   String,
    email:   String,
    channel: { type: String, enum: ["whatsapp", "mail", "in_app"], default: "in_app" },
    ackedAt: { type: Date, default: null },
    ackedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ackNotes: String,
  },
  { _id: true }
);

const drawingReleaseLogSchema = new mongoose.Schema(
  {
    drawingId:   { type: mongoose.Schema.Types.ObjectId, ref: "Drawing", required: true, index: true },
    projectId:   { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    releasedBy:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    releasedAt:  { type: Date, default: Date.now },
    version:     Number,
    title:       String,
    recipients:  { type: [recipientSchema], default: [] },
    notes:       String,
  },
  {
    timestamps: true,
    collection: "pms_drawing_release_logs",
  }
);

drawingReleaseLogSchema.index({ projectId: 1, releasedAt: -1 });

module.exports = mongoose.model(
  "DrawingReleaseLog",
  drawingReleaseLogSchema,
  "pms_drawing_release_logs"
);
