const jwt = require("jsonwebtoken");
const Role = require("../modules/auth/models/Role.model");

// ─── Verify JWT token ───────────────────────────────────────────────────────
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Access denied. No token provided." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secretkey");

    req.user = decoded; // { id, email, role }
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired. Please log in again." });
    }
    return res.status(401).json({ message: "Invalid token." });
  }
};

// ─── Load user effective permissions (attach to req.permissions) ────────────
// Call this after verifyToken when you need permission-level checks.
const loadPermissions = async (req, res, next) => {
  try {
    if (!req.user) return next();

    // Admin shortcut — wildcard in role document
    const role = await Role.findOne({ name: req.user.role }).lean();
    const rolePermissions = role ? role.permissions : [];

    // Merge role permissions + user custom permissions (if stored on token)
    const customPermissions = req.user.customPermissions || [];
    req.permissions = [...new Set([...rolePermissions, ...customPermissions])];

    next();
  } catch (err) {
    // Don't fail the request if permission load fails — just empty permissions
    req.permissions = [];
    next();
  }
};

// ─── Check if req.permissions includes the given permission ─────────────────
const hasPermission = (permissions, permission) => {
  if (!permissions) return false;
  if (permissions.includes("*")) return true; // Admin wildcard
  return permissions.includes(permission);
};

// ─── Route-level permission guard ────────────────────────────────────────────
// Usage: router.get('/get', verifyToken, requirePermission('crm.read'), controller)
const requirePermission = (permission) => async (req, res, next) => {
  // Load permissions if not already loaded
  if (!req.permissions) {
    try {
      const role = await Role.findOne({ name: req.user?.role }).lean();
      req.permissions = role ? role.permissions : [];
      const customPermissions = req.user?.customPermissions || [];
      req.permissions = [...new Set([...req.permissions, ...customPermissions])];
    } catch {
      req.permissions = [];
    }
  }

  if (!hasPermission(req.permissions, permission)) {
    return res.status(403).json({
      message: `Access denied. Requires permission: ${permission}`,
    });
  }
  next();
};

// ─── Role guard (quick check without full permission resolution) ─────────────
// Usage: router.post('/create', verifyToken, requireRole('admin', 'manager'), controller)
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated." });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      message: `Access denied. Requires role: ${roles.join(" or ")}`,
    });
  }
  next();
};

module.exports = { verifyToken, loadPermissions, requirePermission, requireRole, hasPermission };
