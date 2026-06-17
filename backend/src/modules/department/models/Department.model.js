const mongoose = require("mongoose");

/**
 * Department — admin-managed master data for categorizing delegated work
 * (e.g. Design, MIS, Accounts, Marketing, HR + future teams).
 *
 * Business purpose: a Department is an ORGANIZATIONAL/CATEGORIZATION unit, NOT
 * a permission boundary. It answers "which team owns this work / whose workload
 * is this", and drives filtering and (later) workload dashboards. Access control
 * is governed entirely by Role (RBAC permission strings) — the two are orthogonal.
 *
 * Created/edited/deactivated from the Admin UI only. The collection is NEVER
 * seeded; the system functions with zero departments, and a delegation's
 * department is optional until departments are configured.
 *
 * Mirrors the existing `Responsibility` master-data pattern (slug + isActive +
 * order + color + icon, soft-deactivate rather than hard-delete when in use).
 */
const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Department name is required"],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-z0-9_-]+$/,
        "Slug must contain only lowercase letters, numbers, hyphens, and underscores",
      ],
    },
    // Hex color for the department badge (consumed by the Modern Luxe UI).
    color: {
      type: String,
      default: "#C19A45",
    },
    // lucide-react icon name (e.g. 'Building2', 'PenTool', 'Calculator').
    icon: {
      type: String,
      default: "Building2",
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: "departments",
  }
);

// `slug` already has a unique index from `unique: true` on the field above.
departmentSchema.index({ isActive: 1, order: 1 });

departmentSchema.statics.findBySlug = function (slug) {
  return this.findOne({ slug });
};

module.exports = mongoose.model("Department", departmentSchema, "departments");
