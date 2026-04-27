const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

const loginUser = async (data) => {
  const { email, password } = data;

  // 1. check user
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error("User not found");
  }

  // 2. check password
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new Error("Invalid credentials");
  }

  // 3. generate token
  const token = jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_SECRET || "secretkey",
    { expiresIn: "1d" }
  );

  return {
    token,
    user,
  };
};

//----------------------change password---------------------
const changePassword = async (userId, data) => {
  const { oldPassword, newPassword } = data;

  // 1. find user
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  // 2. check old password
  const isMatch = await bcrypt.compare(oldPassword, user.password);
  if (!isMatch) {
    throw new Error("Old password is incorrect");
  }

  // 3. hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // 4. update password
  user.password = hashedPassword;
  await user.save();

  return { message: "Password changed successfully" };
};

module.exports = { loginUser, changePassword };