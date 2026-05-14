const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const Role = require("../models/Role.model");

const loginUser = async (data) => {
  const { email, password } = data;

  // 1. Find user
  const user = await User.findOne({ email });
  if (!user) throw new Error("User not found");

  // 2. Check password
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new Error("Invalid credentials");

  // 3. Load effective permissions: role permissions + custom overrides
  const roleDoc = await Role.findOne({ name: user.role }).lean();
  const rolePermissions = roleDoc ? roleDoc.permissions : [];
  const customPermissions = user.customPermissions || [];
  const permissions = [...new Set([...rolePermissions, ...customPermissions])];

  // 4. Generate JWT — include role so middleware can use it without DB lookup
  const token = jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET || "secretkey",
    { expiresIn: "1d" }
  );

  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    permissions,
  };
};

const changePassword = async (userId, data) => {
  const { oldPassword, newPassword } = data;

  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const isMatch = await bcrypt.compare(oldPassword, user.password);
  if (!isMatch) throw new Error("Old password is incorrect");

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  return { message: "Password changed successfully" };
};

module.exports = { loginUser, changePassword };
