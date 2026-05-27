const DesignComment = require("../models/DesignComment.model");
const Drawing = require("../models/Drawing.model");
const { addCommentSchema } = require("../validator/DesignComment.validator");
const { logActivity } = require("../../../shared/activityLogger");

const POPULATE_AUTHOR = { path: "authorId", select: "name role" };

/**
 * @route GET /api/pms/design-comments/:drawingId
 */
const getComments = async (req, res) => {
  try {
    const { drawingId } = req.params;

    const drawing = await Drawing.findById(drawingId).lean();
    if (!drawing) {
      return res.status(404).json({ message: "Drawing not found" });
    }

    const comments = await DesignComment.find({ drawingId })
      .populate(POPULATE_AUTHOR)
      .sort({ createdAt: 1 });

    res.status(200).json({ count: comments.length, comments });
  } catch (error) {
    console.error("[getComments]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route POST /api/pms/design-comments/:drawingId
 */
const addComment = async (req, res) => {
  try {
    const { error, value } = addCommentSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });
    }

    const { drawingId } = req.params;

    const drawing = await Drawing.findById(drawingId).lean();
    if (!drawing) {
      return res.status(404).json({ message: "Drawing not found" });
    }

    const comment = await DesignComment.create({
      drawingId,
      projectId: drawing.projectId,
      authorId: req.user._id,
      ...value,
    });

    await comment.populate(POPULATE_AUTHOR);

    logActivity({
      projectId:   drawing.projectId,
      actorId:     req.user._id,
      entityType:  "drawing",
      entityId:    drawingId,
      action:      "commented",
      description: `Comment added on drawing "${drawing.title}"`,
    });

    res.status(201).json({ message: "Comment added", comment });
  } catch (error) {
    console.error("[addComment]", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getComments, addComment };
