const express = require("express");
const router = express.Router();
const { createBOQ , getAllBOQ, getBOQById, updateBOQ, deleteBOQ} = require("../controllers/Boq.controller");

router.post("/createBoq", createBOQ);
router.get("/getBoq", getAllBOQ);
router.get("/get",getBOQById);
router.put("/updateBoq/:id", updateBOQ);
router.delete("/delete", deleteBOQ)

module.exports = router;