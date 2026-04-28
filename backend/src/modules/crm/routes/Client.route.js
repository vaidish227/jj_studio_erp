const express = require("express");
const router = express.Router();

const { createClient, getClients, getClientById, updateClient, deleteClient, getTotalClients} = require("../controllers/Client.controller");

router.post("/createclient", createClient);
router.get("/get", getClients);
router.get("/get/:id", getClientById);
router.put("/update/:id", updateClient);
router.delete("/delete/:id", deleteClient);
router.get("/totalclient", getTotalClients)

module.exports = router;