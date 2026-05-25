const express = require("express");
const router  = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const { getComments, addComment } = require("../controllers/DesignComment.controller");

// GET  /api/pms/design-comments/:drawingId  — fetch comment thread for a drawing
// POST /api/pms/design-comments/:drawingId  — add a comment

router.get( "/:drawingId", requirePermission("design.comment"), getComments);
router.post("/:drawingId", requirePermission("design.comment"), addComment);

module.exports = router;
