const bcrypt = require("bcrypt");
const User = require("../models/user.model");
const { loginSchema, changePasswordSchema } = require("../validator/auth.validator");
const { loginUser, changePassword } = require("../service/auth.service");


const signup = async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        // 1. Basic validation
        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Name, email and password are required",
            });
        }

        // 2. Check existing user
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                message: "User already exists",
            });
        }

        // 3. Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 4. Create user
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            phone,
        });

        // 5. Response
        res.status(201).json({
            message: "Signup successful",
            user,
        });

    } catch (error) {
        res.status(500).json({
            message: error.message,
        });
    }
};



const login = async (req, res) => {
  try {
    // validation
    const { error } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        message: error.message,
      });
    }

    // service call
    const result = await loginUser(req.body);

    res.status(200).json({
      message: "Login successful ✅",
      ...result,
    });

  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
};

const changePasswordController = async (req, res) => {
  try {
    // validation
    const { error } = changePasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    // ⚠️ assume userId mil raha hai (JWT middleware se)
    const userId = req.user?.id || req.body.userId;

    const result = await changePassword(userId, req.body);

    res.status(200).json(result);

  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = { signup, login , changePasswordController};