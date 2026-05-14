const Role = require("../../auth/models/Role.model");
const User = require("../../auth/models/user.model");
const { ALL_PERMISSIONS } = require("../../auth/models/Role.model");

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
    const validRoles = ["admin", "md", "manager", "sales", "accounts", "designer", "supervisor", "vendor", "client"];

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

module.exports = {
  getAllRoles,
  getRoleById,
  getAllPermissions,
  createRole,
  updateRole,
  deleteRole,
  getAllUsers,
  updateUserRole,
};
