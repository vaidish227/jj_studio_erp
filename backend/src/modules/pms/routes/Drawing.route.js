const express = require("express");
const router = express.Router();
const {
  uploadDrawing,
  getDrawingsByTask,
  updateDrawingStatus,
  releaseDrawing,
  deleteDrawing,
} = require("../controllers/Drawing.controller");

// Upload Drawing (DLR)
router.post("/upload", uploadDrawing);

// Get Drawing History for a Task
router.get("/task/:taskId", getDrawingsByTask);

// Update Status (Approval/Reject)
router.patch("/status/:id", updateDrawingStatus);

// Release to Site
router.patch("/release/:id", releaseDrawing);

// Delete Drawing
router.delete("/delete/:id", deleteDrawing);

module.exports = router;
