const Material = require("../models/Material.model");

/**
 * @desc Create a new Material Selection
 * @route POST /api/pms/material/create
 */
const createMaterial = async (req, res) => {
  try {
    const material = await Material.create(req.body);
    res.status(201).json({ success: true, message: "Material selection recorded", material });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Get all Materials for a Project
 */
const getProjectMaterials = async (req, res) => {
  try {
    const materials = await Material.find({ projectId: req.params.projectId })
      .populate("taskId", "title")
      .sort({ category: 1 });

    res.status(200).json({ success: true, count: materials.length, materials });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Update Material status/details
 */
const updateMaterial = async (req, res) => {
  try {
    const material = await Material.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    res.status(200).json({ success: true, material });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createMaterial,
  getProjectMaterials,
  updateMaterial
};
