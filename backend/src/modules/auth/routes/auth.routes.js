const express = require("express");
const router = express.Router();

const { signup, login, meController, changePasswordController } = require("../controllers/auth.controller");
const { verifyToken } = require("../../../middleware/auth.middleware");

router.post("/signup", signup);
router.post("/login", login);
// Authed routes — auth.routes is mounted before the global verifyToken in app.js,
// so attach it explicitly here.
router.get("/me", verifyToken, meController);
router.post("/change-password", verifyToken, changePasswordController);

module.exports = router;