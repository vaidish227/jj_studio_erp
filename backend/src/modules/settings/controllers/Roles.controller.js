const bcrypt = require("bcrypt");
const Role = require("../../auth/models/Role.model");
const User = require("../../auth/models/user.model");
const { ALL_PERMISSIONS } = require("../../auth/models/Role.model");
const { PERMISSION_REGISTRY, listGroups } = require("../../auth/permissions/registry");
const { PRESETS, PRESETS_VERSION } = require("../../auth/permissions/presets");

// ─── GET /api/roles ───────────────────────────────────────────────────────────
const getAllRoles = async (req, res) => {
  try {
    const roles = await Role.find().sort({ isSystem: -1, name: 1 }).lean();
    return res.status(200).json({ message: "Roles fetched", data: roles });
  } catch (err) {
    console.error("[getAllRoles]", err);
    return res.status(500).json({ message: err.message });
  }
};

// ─── GET /api/roles/:id ───────────────────────────────────────────────────────
const getRoleById = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id).lean();
    if (!role) return res.status(404).json({ message: "Role not found" });
    return res.status(200).json({ message: "Role fetched", data: role });
  } catch (err) {
    console.error("[getRoleById]", err);
    return res.status(500).json({ message: err.message });
  }
};

// ─── GET /api/roles/permissions/all ──────────────────────────────────────────
const getAllPermissions = async (req, res) => {
  try {
    return res.status(200).json({ message: "Permissions list", data: ALL_PERMISSIONS });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─── GET /api/roles/registry ──────────────────────────────────────────────────
// Structured Module → Section → Action catalogue that drives the Roles &
// Permissions UI. Derived from the single source of truth (permissions/registry).
const getRegistry = async (req, res) => {
  try {
    return res.status(200).json({
      message: "Permission registry",
      data: { groups: listGroups(), modules: PERMISSION_REGISTRY },
    });
  } catch (err) {
    console.error("[getRegistry]", err);
    return res.status(500).json({ message: err.message });
  }
};

// ─── GET /api/roles/presets ───────────────────────────────────────────────────
// Curated role templates (permission bundles) used as starting points in the
// Roles & Permissions UI. Read-only convenience — does not alter any role.
const getPresets = async (req, res) => {
  try {
    return res.status(200).json({
      message: "Permission presets",
      data: { version: PRESETS_VERSION, presets: PRESETS },
    });
  } catch (err) {
    console.error("[getPresets]", err);
    return res.status(500).json({ message: err.message });
  }
};

// ─── POST /api/roles ──────────────────────────────────────────────────────────
const createRole = async (req, res) => {
  try {
    const { name, displayName, description, permissions, color } = req.body;

    if (!name || !displayName) {
      return res.status(400).json({ message: "name and displayName are required" });
    }

    const existing = await Role.findOne({ name: name.toLowerCase().trim() });
    if (existing) return res.status(409).json({ message: "Role with this name already exists" });

    const role = await Role.create({
      name: name.toLowerCase().trim(),
      displayName: displayName.trim(),
      description: description || "",
      permissions: permissions || [],
      color: color || "#6B6B6B",
      isSystem: false,
    });

    return res.status(201).json({ message: "Role created", data: role });
  } catch (err) {
    console.error("[createRole]", err);
    return res.status(500).json({ message: err.message });
  }
};

// ─── PUT /api/roles/:id ───────────────────────────────────────────────────────
// Updates permissions and display info. Cannot change name of system roles.
const updateRole = async (req, res) => {
  try {
    const { displayName, description, permissions, color } = req.body;
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ message: "Role not found" });

    if (displayName) role.displayName = displayName;
    if (description !== undefined) role.description = description;
    if (permissions) role.permissions = permissions;
    if (color) role.color = color;

    await role.save();
    return res.status(200).json({ message: "Role updated", data: role });
  } catch (err) {
    console.error("[updateRole]", err);
    return res.status(500).json({ message: err.message });
  }
};

// ─── DELETE /api/roles/:id ────────────────────────────────────────────────────
const deleteRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ message: "Role not found" });
    if (role.isSystem) {
      return res.status(403).json({ message: "Cannot delete a system role" });
    }

    const usersWithRole = await User.countDocuments({ role: role.name });
    if (usersWithRole > 0) {
      return res.status(409).json({
        message: `Cannot delete role — ${usersWithRole} user(s) still assigned to it`,
      });
    }

    await Role.findByIdAndDelete(req.params.id);
    return res.status(200).json({ message: "Role deleted" });
  } catch (err) {
    console.error("[deleteRole]", err);
    return res.status(500).json({ message: err.message });
  }
};

// ─── GET /api/roles/users/list ────────────────────────────────────────────────
// Returns all users for admin management
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, "-password").sort({ createdAt: -1 }).lean();
    return res.status(200).json({ message: "Users fetched", data: users });
  } catch (err) {
    console.error("[getAllUsers]", err);
    return res.status(500).json({ message: err.message });
  }
};

// ─── PATCH /api/roles/users/:userId/role ─────────────────────────────────────
// Update a user's assigned role
const updateUserRole = async (req, res) => {
  try {
    const { role, customPermissions } = req.body;
    const validRoles = ["admin", "md", "manager", "sales", "accounts", "designer", "supervisor", "vendor", "client", "mis", "marketing", "hr"];

    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ message: `Invalid role. Must be one of: ${validRoles.join(", ")}` });
    }

    const updates = {};
    if (role) updates.role = role;
    if (customPermissions !== undefined) updates.customPermissions = customPermissions;

    const user = await User.findByIdAndUpdate(req.params.userId, { $set: updates }, { new: true, select: "-password" });
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.status(200).json({ message: "User role updated", data: user });
  } catch (err) {
    console.error("[updateUserRole]", err);
    return res.status(500).json({ message: err.message });
  }
};

// ─── PATCH /api/roles/users/:userId ──────────────────────────────────────────
// Full user profile update by admin (name, email, phone, dept, designation, role, isActive, customPermissions)
const updateUser = async (req, res) => {
  try {
    const { name, email, phone, department, designation, role, isActive, customPermissions } = req.body;
    const validRoles = ["admin", "md", "manager", "sales", "accounts", "designer", "supervisor", "vendor", "client", "mis", "marketing", "hr"];

    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ message: `Invalid role: ${role}` });
    }

    if (email) {
      const conflict = await User.findOne({ email: email.toLowerCase().trim(), _id: { $ne: req.params.userId } });
      if (conflict) return res.status(409).json({ message: "Email already in use by another user" });
    }

    const updates = {};
    if (name        !== undefined) updates.name        = name.trim();
    if (email       !== undefined) updates.email       = email.toLowerCase().trim();
    if (phone       !== undefined) updates.phone       = phone;
    if (department  !== undefined) updates.department  = department;
    if (designation !== undefined) updates.designation = designation;
    if (role        !== undefined) updates.role        = role;
    if (isActive    !== undefined) updates.isActive    = isActive;
    if (customPermissions !== undefined) {
      const invalid = customPermissions.filter((p) => !ALL_PERMISSIONS.includes(p) && p !== '*');
      if (invalid.length > 0) {
        return res.status(400).json({ message: `Invalid permissions: ${invalid.join(', ')}` });
      }
      updates.customPermissions = customPermissions;
    }

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { $set: updates },
      { new: true, select: "-password" }
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.status(200).json({ message: "User updated", data: user });
  } catch (err) {
    console.error("[updateUser]", err);
    return res.status(500).json({ message: err.message });
  }
};

// ─── POST /api/roles/users/:userId/reset-password ─────────────────────────────
// Admin sets a new password for any user (no old password required)
const adminResetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { $set: { password: hashed } },
      { new: true, select: "-password" }
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.status(200).json({ message: "Password reset successfully" });
  } catch (err) {
    console.error("[adminResetPassword]", err);
    return res.status(500).json({ message: err.message });
  }
};

// ─── GET /api/roles/users/:userId/effective-permissions ──────────────────────
// Returns the merged effective permission set: role perms + custom overrides
const getEffectivePermissions = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password').lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const roleDoc = await Role.findOne({ name: user.role }).lean();
    const rolePermissions = roleDoc ? roleDoc.permissions : [];
    const customPermissions = user.customPermissions || [];
    const effective = [...new Set([...rolePermissions, ...customPermissions])];

    return res.status(200).json({
      message: "Effective permissions",
      data: {
        userId: user._id,
        name: user.name,
        role: user.role,
        rolePermissions,
        customPermissions,
        effective,
      },
    });
  } catch (err) {
    console.error("[getEffectivePermissions]", err);
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getAllRoles,
  getRoleById,
  getAllPermissions,
  getRegistry,
  getPresets,
  createRole,
  updateRole,
  deleteRole,
  getAllUsers,
  updateUserRole,
  updateUser,
  adminResetPassword,
  getEffectivePermissions,
};
