const Joi = require("joi");
const DrawingAnnotation = require("../models/DrawingAnnotation.model");
const Drawing           = require("../models/Drawing.model");

// ─── Joi schemas ─────────────────────────────────────────────────────────────
// All coordinates are normalized to [0, 1]. Validators enforce that so a
// malformed payload can't pollute the DB with off-canvas geometry.
const normCoord = Joi.number().min(0).max(1);

const pointSchema = Joi.object({
  x: normCoord.required(),
  y: normCoord.required(),
});

const rectSchema = Joi.object({
  x: normCoord.required(),
  y: normCoord.required(),
  w: normCoord.required(),
  h: normCoord.required(),
});

const createAnnotationSchema = Joi.object({
  drawingVersion: Joi.number().integer().min(1).required(),
  type:           Joi.string().valid("pen", "rectangle", "pin").required(),
  color:          Joi.string().pattern(/^#[0-9a-fA-F]{6}$/).default("#E74C3C"),
  strokeWidth:    Joi.number().integer().min(1).max(12).default(2),
  comment:        Joi.string().allow("").max(1000).default(""),

  // Geometry — only one populated per type
  points: Joi.array().items(pointSchema).min(2).max(2000),
  rect:   rectSchema,
  point:  pointSchema,
})
  // Enforce: the right geometry field for the chosen type, and required
  // comment for pins.
  .custom((value, helpers) => {
    if (value.type === "pen") {
      if (!value.points || !value.points.length) {
        return helpers.error("any.custom", { message: "points required for pen" });
      }
    } else if (value.type === "rectangle") {
      if (!value.rect) {
        return helpers.error("any.custom", { message: "rect required for rectangle" });
      }
    } else if (value.type === "pin") {
      if (!value.point) {
        return helpers.error("any.custom", { message: "point required for pin" });
      }
      if (!value.comment || !value.comment.trim()) {
        return helpers.error("any.custom", { message: "comment required for pin" });
      }
    }
    return value;
  });

const updateAnnotationSchema = Joi.object({
  comment: Joi.string().allow("").max(1000),
  point:   pointSchema,
  rect:    rectSchema,
  points:  Joi.array().items(pointSchema).min(2).max(2000),
}).min(1);

const POPULATE_AUTHOR = { path: "createdBy", select: "name email" };

/**
 * @route GET /api/pms/drawing/:id/annotations?version=N
 * Lists every annotation on a drawing's specific revision. If `version`
 * is omitted, the drawing's current version is used.
 */
async function listAnnotations(req, res) {
  try {
    const drawing = await Drawing.findById(req.params.id).select("version").lean();
    if (!drawing) return res.status(404).json({ message: "Drawing not found" });

    const versionRaw = req.query.version;
    const version = versionRaw != null ? Number(versionRaw) : drawing.version;
    if (!Number.isFinite(version)) {
      return res.status(400).json({ message: "Invalid version" });
    }

    const annotations = await DrawingAnnotation.find({
      drawingId: req.params.id,
      drawingVersion: version,
    })
      .populate(POPULATE_AUTHOR)
      .sort({ createdAt: 1 })
      .lean();

    res.json({ count: annotations.length, version, annotations });
  } catch (err) {
    console.error("[listAnnotations]", err);
    res.status(500).json({ message: err.message });
  }
}

/**
 * @route POST /api/pms/drawing/:id/annotations
 * Permission: drawings.approve (manager-level).
 */
async function createAnnotation(req, res) {
  try {
    const { error, value } = createAnnotationSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        message: error.details.map((d) => d.message).join("; "),
      });
    }

    const drawing = await Drawing.findById(req.params.id).select("version").lean();
    if (!drawing) return res.status(404).json({ message: "Drawing not found" });

    const userId = req.user._id || req.user.id;
    const annotation = await DrawingAnnotation.create({
      drawingId:      req.params.id,
      drawingVersion: value.drawingVersion,
      type:           value.type,
      color:          value.color,
      strokeWidth:    value.strokeWidth,
      comment:        value.comment,
      points:         value.points,
      rect:           value.rect,
      point:          value.point,
      createdBy:      userId,
    });

    const populated = await annotation.populate(POPULATE_AUTHOR);
    res.status(201).json({ annotation: populated });
  } catch (err) {
    console.error("[createAnnotation]", err);
    res.status(500).json({ message: err.message });
  }
}

/**
 * @route DELETE /api/pms/drawing/annotation/:annotationId
 * Permission: drawings.approve. Author can always delete their own. Users
 * with `drawings.release` (PD/principal tier) can delete any annotation.
 */
async function deleteAnnotation(req, res) {
  try {
    const annotation = await DrawingAnnotation.findById(req.params.annotationId);
    if (!annotation) return res.status(404).json({ message: "Annotation not found" });

    const userId     = req.user._id || req.user.id;
    const isAuthor   = String(annotation.createdBy) === String(userId);
    const isOverride = (req.permissions || []).includes("drawings.release")
                    || (req.permissions || []).includes("*");

    if (!isAuthor && !isOverride) {
      return res.status(403).json({ message: "You can only delete annotations you created" });
    }

    await annotation.deleteOne();
    res.json({ message: "Annotation deleted", id: req.params.annotationId });
  } catch (err) {
    console.error("[deleteAnnotation]", err);
    res.status(500).json({ message: err.message });
  }
}

/**
 * @route PATCH /api/pms/drawing/annotation/:annotationId
 * Partial update — used for pin drag (point), rectangle resize (rect),
 * pen reshape (points), and comment edits (comment). Author-only,
 * with `drawings.release` as override.
 */
async function updateAnnotation(req, res) {
  try {
    const { error, value } = updateAnnotationSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        message: error.details.map((d) => d.message).join("; "),
      });
    }

    const annotation = await DrawingAnnotation.findById(req.params.annotationId);
    if (!annotation) return res.status(404).json({ message: "Annotation not found" });

    const userId     = req.user._id || req.user.id;
    const isAuthor   = String(annotation.createdBy) === String(userId);
    const isOverride = (req.permissions || []).includes("drawings.release")
                    || (req.permissions || []).includes("*");

    if (!isAuthor && !isOverride) {
      return res.status(403).json({ message: "You can only edit annotations you created" });
    }

    // Enforce geometry-vs-type consistency: don't let a pen update arrive
    // with a `point` field, etc.
    if (value.point  && annotation.type !== "pin") {
      return res.status(400).json({ message: "point is only valid for pin annotations" });
    }
    if (value.rect   && annotation.type !== "rectangle") {
      return res.status(400).json({ message: "rect is only valid for rectangle annotations" });
    }
    if (value.points && annotation.type !== "pen") {
      return res.status(400).json({ message: "points is only valid for pen annotations" });
    }

    if (value.comment != null) annotation.comment = value.comment;
    if (value.point)           annotation.point   = value.point;
    if (value.rect)            annotation.rect    = value.rect;
    if (value.points)          annotation.points  = value.points;

    await annotation.save();
    const populated = await annotation.populate(POPULATE_AUTHOR);
    res.json({ annotation: populated });
  } catch (err) {
    console.error("[updateAnnotation]", err);
    res.status(500).json({ message: err.message });
  }
}

module.exports = {
  listAnnotations,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
};
