const express = require("express");
const router  = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const {
  createRevisionRequest,
  getRevisionRequestsByDrawing,
  resolveRevisionRequest,
} = require("../controllers/DesignRevisionRequest.controller");

// Route order: specific paths before dynamic /:id paths
// GET  /api/pms/design-revisions/drawing/:drawingId  — list revision requests for a drawing
// POST /api/pms/design-revisions                     — create a revision request
// PATCH /api/pms/design-revisions/:id/resolve        — resolve a revision request

router.get(   "/drawing/:drawingId",  requirePermission("drawings.approve"), getRevisionRequestsByDrawing);
router.post(  "/",                    requirePermission("drawings.approve"), createRevisionRequest);
router.patch( "/:id/resolve",         requirePermission("design.comment"),   resolveRevisionRequest);

module.exports = router;
