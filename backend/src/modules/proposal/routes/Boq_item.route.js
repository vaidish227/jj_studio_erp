const express = require("express");
const router = express.Router();
const { addBOQItem} = require("../controllers/Boq_item.controller")

router.post("/create", addBOQItem);


module.exports = router;