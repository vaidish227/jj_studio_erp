const express = require("express");
const router = express.Router();
const templateController = require("../controllers/Template.controller");
// Assuming there is an auth middleware, for now we leave it open or you can attach it
// const authMiddleware = require("../../../middlewares/auth.middleware");

router.post("/create", templateController.createTemplate);
router.get("/getall", templateController.getAllTemplates);
router.get("/get/:id", templateController.getTemplateById);
router.put("/update/:id", templateController.updateTemplate);
router.delete("/delete/:id", templateController.deleteTemplate);

module.exports = router;
