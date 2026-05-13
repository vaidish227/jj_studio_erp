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
app.use("/api/followup", followupRoutes);

const mettingRoutes = require("../src/modules/crm/routes/Metting.routes");
app.use("/api/metting", mettingRoutes);

const proposalRoutes = require("../src/modules/crm/routes/Proposal.route");
app.use("/api/proposal", proposalRoutes);

const BoqRoutes = require("../src/modules/proposal/routes/Boq.route");
app.use("/api/boq", BoqRoutes);

const Boq_itemRoutes = require("../src/modules/proposal/routes/Boq_item.route");
app.use("/api/boqitem", Boq_itemRoutes);

const TemplateRoutes = require("../src/modules/proposal/routes/Template_route");
app.use("/api/Template", TemplateRoutes);

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

const whatsappRoutes = require("../src/modules/whatspp/routes/whatsapp.route");
app.use("/api/whatsapp", whatsappRoutes);

const pmsProjectRoutes = require("../src/modules/pms/routes/Project.route");
app.use("/api/pms/project", pmsProjectRoutes);

const pmsTaskRoutes = require("../src/modules/pms/routes/Task.route");
app.use("/api/pms/task", pmsTaskRoutes);

const pmsDrawingRoutes = require("../src/modules/pms/routes/Drawing.route");
app.use("/api/pms/drawing", pmsDrawingRoutes);

const pmsVendorRoutes = require("../src/modules/pms/routes/Vendor.route");
app.use("/api/pms/vendor", pmsVendorRoutes);

const pmsSiteLogRoutes = require("../src/modules/pms/routes/SiteLog.route");
app.use("/api/pms/sitelog", pmsSiteLogRoutes);

const pmsPurchaseOrderRoutes = require("../src/modules/pms/routes/PurchaseOrder.route");
app.use("/api/pms/po", pmsPurchaseOrderRoutes);

const pmsMaterialRoutes = require("../src/modules/pms/routes/Material.route");
app.use("/api/pms/material", pmsMaterialRoutes);

const pmsApprovalRoutes = require("../src/modules/pms/routes/Approval.route");
app.use("/api/pms/approval", pmsApprovalRoutes);

const pmsSiteVisitRoutes = require("../src/modules/pms/routes/SiteVisit.route");
app.use("/api/pms/sitevisit", pmsSiteVisitRoutes);

const pmsDashboardRoutes = require("../src/modules/pms/routes/PMSDashboard.route");
app.use("/api/pms/dashboard", pmsDashboardRoutes);

module.exports = app;









