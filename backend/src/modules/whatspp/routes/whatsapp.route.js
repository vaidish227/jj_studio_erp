const express = require("express");
const router = express.Router();
const { sendLeadMessage } = require( "../controllers/whatsapp.controller.js");

router.post("/send-lead-message", sendLeadMessage);

module.exports = router;