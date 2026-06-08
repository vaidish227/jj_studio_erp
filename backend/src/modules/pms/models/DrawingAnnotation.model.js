const mongoose = require("mongoose");

/**
 * DrawingAnnotation — manager-level markup on top of a drawing image.
 *
 * Coordinates are stored as NORMALIZED values in [0, 1] relative to the
 * drawing's intrinsic image dimensions. The frontend converts to pixels at
 * render time. This way the same annotation looks correct regardless of
 * zoom level or display size.
 *
 * Types:
 *   - "pen"       freehand stroke (array of points)
 *   - "rectangle" axis-aligned box
 *   - "pin"       single point with a comment (sticky note)
 */
const drawingAnnotationSchema = new mongoose.Schema(
  {
    drawingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Drawing",
      required: true,
      index: true,
    },
    // Pinned to a specific revision — when a new version is uploaded, the
    // old annotations stay attached to the version they were made against.
    drawingVersion: {
      type: Number,
      required: true,
      default: 1,
    },

    type: {
      type: String,
      enum: ["pen", "rectangle", "pin"],
      required: true,
    },

    // Geometry, normalized to [0,1]. Only one of these is populated per type.
    points: [{ x: Number, y: Number, _id: false }], // pen
    rect:   { x: Number, y: Number, w: Number, h: Number, _id: false }, // rectangle
    point:  { x: Number, y: Number, _id: false }, // pin

    color: { type: String, default: "#E74C3C" }, // hex
    strokeWidth: { type: Number, default: 2, min: 1, max: 12 },

    // Optional text — required for pins, optional for other shapes.
    comment: { type: String, default: "", trim: true, maxlength: 1000 },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "pms_drawing_annotations",
  }
);

// Fast lookup of annotations for a given drawing+version
drawingAnnotationSchema.index({ drawingId: 1, drawingVersion: 1, createdAt: 1 });

module.exports = mongoose.model(
  "DrawingAnnotation",
  drawingAnnotationSchema,
  "pms_drawing_annotations"
);
