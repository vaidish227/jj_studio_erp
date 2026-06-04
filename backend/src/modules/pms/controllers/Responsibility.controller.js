const Responsibility = require("../models/Responsibility.model");
const Project = require("../models/Project.model");
const {
  createResponsibilitySchema,
  updateResponsibilitySchema,
  RESERVED_SLUGS,
} = require("../validator/Responsibility.validator");
const { invalidateSlugCache } = require("../services/teamResolver");

/**
 * @route GET /api/pms/responsibility/all
 * Returns all responsibilities, active first, then archived.
 */
const listResponsibilities = async (req, res) => {
  try {
    const { activeOnly } = req.query;
    const filter = activeOnly === "true" ? { isActive: true } : {};
    const responsibilities = await Responsibility.find(filter).sort({
      isActive: -1,
      order: 1,
      name: 1,
    });
    res.status(200).json({ count: responsibilities.length, responsibilities });
  } catch (error) {
    console.error("[listResponsibilities]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route POST /api/pms/responsibility/create
 */
const createResponsibility = async (req, res) => {
  try {
    const { error, value } = createResponsibilitySchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      return res
        .status(400)
        .json({ message: error.details.map((d) => d.message).join("; ") });
    }

    // Slug uniqueness — DB has a unique index, but a friendlier 400 first.
    const existing = await Responsibility.findOne({ slug: value.slug });
    if (existing) {
      return res
        .status(400)
        .json({ message: `A responsibility with slug "${value.slug}" already exists` });
    }

    // Admins cannot create rows claiming a reserved slug (those are
    // seeded by the migration script).
    if (RESERVED_SLUGS.includes(value.slug)) {
      return res.status(400).json({
        message: `"${value.slug}" is a reserved system slug`,
      });
    }

    const responsibility = await Responsibility.create({ ...value, system: false });
    invalidateSlugCache();

    res
      .status(201)
      .json({ message: "Responsibility created", responsibility });
  } catch (error) {
    console.error("[createResponsibility]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route PATCH /api/pms/responsibility/update/:id
 */
const updateResponsibility = async (req, res) => {
  try {
    const { error, value } = updateResponsibilitySchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      return res
        .status(400)
        .json({ message: error.details.map((d) => d.message).join("; ") });
    }

    const responsibility = await Responsibility.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    );
    if (!responsibility) {
      return res.status(404).json({ message: "Responsibility not found" });
    }
    invalidateSlugCache();

    res
      .status(200)
      .json({ message: "Responsibility updated", responsibility });
  } catch (error) {
    console.error("[updateResponsibility]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route DELETE /api/pms/responsibility/delete/:id
 * Refuses to delete system rows or any responsibility referenced by
 * an existing project's assignments. Falls back to archive (isActive=false)
 * when ?archive=true is passed.
 */
const deleteResponsibility = async (req, res) => {
  try {
    const { archive } = req.query;
    const responsibility = await Responsibility.findById(req.params.id);
    if (!responsibility) {
      return res.status(404).json({ message: "Responsibility not found" });
    }

    if (archive === "true") {
      responsibility.isActive = false;
      await responsibility.save();
      invalidateSlugCache();
      return res
        .status(200)
        .json({ message: "Responsibility archived", responsibility });
    }

    if (responsibility.system) {
      return res
        .status(400)
        .json({ message: "System responsibilities cannot be deleted. Archive instead." });
    }

    const inUse = await Project.exists({
      "assignments.responsibilityId": responsibility._id,
    });
    if (inUse) {
      return res.status(400).json({
        message:
          "This responsibility is in use on one or more projects. Archive it instead of deleting.",
      });
    }

    await responsibility.deleteOne();
    invalidateSlugCache();
    res.status(200).json({ message: "Responsibility deleted" });
  } catch (error) {
    console.error("[deleteResponsibility]", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  listResponsibilities,
  createResponsibility,
  updateResponsibility,
  deleteResponsibility,
};
