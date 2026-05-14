const Drawing = require("../models/Drawing.model");
const Task = require("../models/Task.model");

/**
 * @desc Upload a new Drawing (DLR)
 * @route POST /api/pms/drawing/upload
 */
const uploadDrawing = async (req, res) => {
  try {
    const { projectId, taskId, title, drawingType, fileUrl, fileType, uploadedBy } = req.body;

    // Check if a drawing with same title already exists for this task to manage versioning
    const latestDrawing = await Drawing.findOne({ taskId, title }).sort({ version: -1 });
    
    const version = latestDrawing ? latestDrawing.version + 1 : 1;

    const drawing = await Drawing.create({
      projectId,
      taskId,
      title,
      drawingType,
      fileUrl,
      fileType,
      version,
      uploadedBy
    });

    res.status(201).json({
      success: true,
      message: version > 1 ? `Drawing version v${version} uploaded` : "Drawing uploaded successfully",
      drawing
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Get all Drawings for a Task (DLR History)
 * @route GET /api/pms/drawing/task/:taskId
 */
const getDrawingsByTask = async (req, res) => {
  try {
    const drawings = await Drawing.find({ taskId: req.params.taskId })
      .populate("uploadedBy", "name")
      .populate("approvedBy", "name")
      .sort({ version: -1 });

    res.status(200).json({
      success: true,
      count: drawings.length,
      drawings
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Update Drawing Status (Approval Logic)
 * @route PATCH /api/pms/drawing/status/:id
 */
const updateDrawingStatus = async (req, res) => {
  try {
    const { status, approvedBy, remarks } = req.body;
    
    const updateData = { status, remarks };
    if (status === "approved") {
      updateData.approvedBy = approvedBy;
      updateData.approvalDate = new Date();
    }

    const drawing = await Drawing.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    );

    if (!drawing) return res.status(404).json({ message: "Drawing not found" });

    res.status(200).json({ success: true, drawing });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Release Drawing to Site (For Supervisor)
 * @route PATCH /api/pms/drawing/release/:id
 */
const releaseDrawing = async (req, res) => {
  try {
    const { releasedBy } = req.body;

    const drawing = await Drawing.findByIdAndUpdate(
      req.params.id,
      { 
        $set: { 
          isReleased: true, 
          status: "released_to_site",
          releasedAt: new Date(),
          releasedBy
        } 
      },
      { new: true }
    );

    if (!drawing) return res.status(404).json({ message: "Drawing not found" });

    // Automatically update the parent task status if needed
    if (drawing.taskId) {
      await Task.findByIdAndUpdate(drawing.taskId, { status: "released_to_site" });
    }

    res.status(200).json({
      success: true,
      message: "Drawing released to site successfully",
      drawing
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Delete Drawing
 */
const deleteDrawing = async (req, res) => {
  try {
    await Drawing.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Drawing deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  uploadDrawing,
  getDrawingsByTask,
  updateDrawingStatus,
  releaseDrawing,
  deleteDrawing
};
