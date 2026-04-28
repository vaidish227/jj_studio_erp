const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());
const authRoutes = require("../src/modules/auth/routes/auth.routes");
app.use("/api/auth", authRoutes);

const leadRoutes = require("../src/modules/crm/routes/Lead.route");
app.use("/api/leads", leadRoutes);

const clientRoutes = require("../src/modules/crm/routes/Client.route");
app.use("/api/clients", clientRoutes);

const followupRoutes = require("../src/modules/crm/routes/FollowUp.route");
app.use("/api/followups", followupRoutes);

const mettingRoutes = require("../src/modules/crm/routes/Metting.routes");
app.use("/api/metting", mettingRoutes);

const proposalRoutes = require("../src/modules/crm/routes/Proposal.route");
app.use("/api/proposal", proposalRoutes);

module.exports = app;