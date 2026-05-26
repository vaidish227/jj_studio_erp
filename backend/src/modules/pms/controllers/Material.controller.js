const Material = require("../models/Material.model");
const { createMaterialSchema, updateMaterialSchema } = require("../validator/Material.validator");

/**
 * @route POST /api/pms/material/create
 */
const createMaterial = async (req, res) => {
  try {
    const { error, value } = createMaterialSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join('; ') });
    }

    if (!value.taskId) delete value.taskId;

    const material = await Material.create(value);
    res.status(201).json({ message: "Material selection recorded", material });
  } catch (error) {
    console.error("[createMaterial]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route GET /api/pms/material/project/:projectId
 */
const getProjectMaterials = async (req, res) => {
  try {
    const materials = await Material.find({ projectId: req.params.projectId })
      .populate("taskId", "title taskType")
      .sort({ category: 1, createdAt: -1 });

    res.status(200).json({ count: materials.length, materials });
  } catch (error) {
    console.error("[getProjectMaterials]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route PUT /api/pms/material/update/:id
 */
const updateMaterial = async (req, res) => {
  try {
    const { error, value } = updateMaterialSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join('; ') });
    }

    const material = await Material.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    );

    if (!material) {
      return res.status(404).json({ message: "Material record not found" });
    }

    res.status(200).json({ message: "Material updated", material });
  } catch (error) {
    console.error("[updateMaterial]", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createMaterial,
  getProjectMaterials,
  updateMaterial,
};
