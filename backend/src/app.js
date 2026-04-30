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

const BoqRoutes = require("../src/modules/proposal/routes/Boq.route");
app.use("/api/boq", BoqRoutes);

const Boq_itemRoutes = require("../src/modules/proposal/routes/Boq_item.route");
app.use("/api/boqitem", Boq_itemRoutes);

const TemplateRoutes = require("../src/modules/proposal/routes/Template_route");
app.use("/api/Template", TemplateRoutes );

const ApproveRoute = require("../src/modules/proposal/routes/Approval.Route");
app.use("/api/Approve", ApproveRoute)

const paymentRoutes = require("../src/modules/proposal/routes/Payment.Routes");
app.use("/api/payment", paymentRoutes);

const proposalVersionRoutes = require("../src/modules/proposal/routes/Proposalversion.Route");
app.use("/api/proposalversion", proposalVersionRoutes);

const activityRoutes = require("../src/modules/proposal/routes/Activity.route");
app.use("/api/activity", activityRoutes);

const esignRoutes = require("../src/modules/proposal/routes/Esign.route");
app.use("/api/esign", esignRoutes);

module.exports = app;