const Department = require("../models/Department.model");
const Delegation = require("../../delegation/models/Delegation.model");
const {
  createDepartmentSchema,
  updateDepartmentSchema,
} = require("../validator/department.validator");

// Derive a URL-safe slug from a display name (e.g. "Front Office" -> "front-office").
const slugify = (name = "") =>
  name
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * @route GET /api/departments
 * Lists departments (active first, then by order, then name). Used by the
 * Create-Delegation dropdown and the Department Admin page.
 * Pass ?active=true to return only active departments.
 */
const listDepartments = async (req, res) => {
  try {
    const filter = req.query.active === "true" ? { isActive: true } : {};
    const departments = await Department.find(filter).sort({
      isActive: -1,
      order: 1,
      name: 1,
    });
    res.status(200).json({ count: departments.length, departments });
  } catch (error) {
    console.error("[listDepartments]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route POST /api/departments
 * Admin-managed creation. Slug is auto-derived from the name when not supplied.
 */
const createDepartment = async (req, res) => {
  try {
    const { error, value } = createDepartmentSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      return res
        .status(400)
        .json({ message: error.details.map((d) => d.message).join("; ") });
    }

    const slug = value.slug || slugify(value.name);
    if (!slug) {
      return res
        .status(400)
        .json({ message: "Could not derive a slug from the name; please provide one." });
    }

    // Friendly 400 before the DB unique index fires.
    const existing = await Department.findOne({ slug });
    if (existing) {
      return res
        .status(400)
        .json({ message: `A department with slug "${slug}" already exists` });
    }

    const department = await Department.create({ ...value, slug });
    res.status(201).json({ message: "Department created", department });
  } catch (error) {
    console.error("[createDepartment]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route PATCH /api/departments/:id
 */
const updateDepartment = async (req, res) => {
  try {
    const { error, value } = updateDepartmentSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      return res
        .status(400)
        .json({ message: error.details.map((d) => d.message).join("; ") });
    }

    // Guard slug uniqueness on rename.
    if (value.slug) {
      const clash = await Department.findOne({
        slug: value.slug,
        _id: { $ne: req.params.id },
      });
      if (clash) {
        return res
          .status(400)
          .json({ message: `A department with slug "${value.slug}" already exists` });
      }
    }

    const department = await Department.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    );
    if (!department) {
      return res.status(404).json({ message: "Department not found" });
    }
    res.status(200).json({ message: "Department updated", department });
  } catch (error) {
    console.error("[updateDepartment]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route DELETE /api/departments/:id
 * Soft-deactivate by default (set isActive=false) — never breaks existing
 * delegations that reference the department. A permanent delete is allowed
 * (?hard=true) ONLY when no delegation references it.
 */
const removeDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ message: "Department not found" });
    }

    const inUse = await Delegation.exists({ departmentId: department._id });

    if (req.query.hard === "true") {
      if (inUse) {
        return res.status(400).json({
          message:
            "This department is referenced by one or more delegations. Deactivate it instead of hard-deleting.",
        });
      }
      await department.deleteOne();
      return res.status(200).json({ message: "Department deleted" });
    }

    // Default: soft-deactivate.
    department.isActive = false;
    await department.save();
    res.status(200).json({ message: "Department deactivated", department });
  } catch (error) {
    console.error("[removeDepartment]", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  listDepartments,
  createDepartment,
  updateDepartment,
  removeDepartment,
};
