// Helper: explicitly load a user's effective permissions when middleware
// hasn't already populated req.permissions. Mirrors the logic in
// auth.middleware.js so we never diverge.

const Role = require("../../auth/models/Role.model");
const User = require("../../auth/models/user.model");

async function loadPermissionsForUser({ userId, role }) {
  try {
    const [roleDoc, userDoc] = await Promise.all([
      role ? Role.findOne({ name: role }).lean() : null,
      userId ? User.findById(userId).select("customPermissions isActive").lean() : null,
    ]);
    if (userDoc?.isActive === false) return { permissions: [], inactive: true };
    const rolePerms = roleDoc?.permissions || [];
    const customPerms = userDoc?.customPermissions || [];
    return { permissions: [...new Set([...rolePerms, ...customPerms])], inactive: false };
  } catch {
    return { permissions: [], inactive: false };
  }
}

module.exports = { loadPermissionsForUser };
