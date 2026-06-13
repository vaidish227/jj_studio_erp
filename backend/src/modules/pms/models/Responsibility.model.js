const mongoose = require("mongoose");

/**
 * Responsibility — admin-managed master list of project responsibilities.
 * Drives Project.assignments and downstream slug-based resolution
 * (teamResolver) instead of hardcoded slot field names.
 *
 * Reserved slugs (lead_designer, supervisor) carry system: true and cannot
 * be deleted — downstream services (notifications, vendor groups, handover)
 * resolve them by slug.
 */
const responsibilitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Responsibility name is required"],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9_]+$/, "Slug must contain only lowercase letters, numbers, and underscores"],
    },
    category: {
      type: String,
      enum: ["design", "site", "exec", "other"],
      default: "design",
    },
    // Reserved system rows (lead_designer, supervisor). Cannot be deleted
    // or have slug changed. Downstream code resolves by slug.
    system: {
      type: Boolean,
      default: false,
    },
    // User roles that should appear in the EmployeePicker for this
    // responsibility (e.g. ['designer','manager']). Empty = no filter.
    defaultRoles: {
      type: [String],
      default: [],
    },
    // Vendor kinds this responsibility owns — drives the
    // vendorWhatsAppGroup routing previously hardcoded as
    // KIND_TO_DESIGNER_SLOT.
    vendorKinds: {
      type: [String],
      default: [],
    },
    // lucide-react icon name (e.g. 'Star', 'Ruler', 'HardHat')
    icon: {
      type: String,
      default: "Users",
    },
    // Tailwind text colour class for the icon (e.g. 'text-blue-600')
    color: {
      type: String,
      default: "text-[var(--text-muted)]",
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
    collection: "pms_responsibilities",
  }
);

responsibilitySchema.index({ slug: 1 }, { unique: true });
responsibilitySchema.index({ isActive: 1, order: 1 });

responsibilitySchema.statics.findBySlug = function (slug) {
  return this.findOne({ slug });
};

module.exports = mongoose.model(
  "Responsibility",
  responsibilitySchema,
  "pms_responsibilities"
);
