const express = require("express");
const router = express.Router();

const { signup , login, changePasswordController} = require("../controllers/auth.controller");

router.post("/signup", signup);
router.post("/login", login);
router.post("/change-password", changePasswordController);

module.exports = router;