const express = require("express");
const router = express.Router();
const { createTemplate, getTemplates, getTemplateById,updateTemplate, deleteTemplate } = require("../controllers/Template.controller")

router.post("/create", createTemplate );
router.get("/get", getTemplates);
router.get("/getbyid/:id", getTemplateById);
router.put("/update/:id", updateTemplate);
router.delete("/delete/:id",  deleteTemplate)
module.exports = router;