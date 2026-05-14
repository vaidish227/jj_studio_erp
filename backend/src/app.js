const express = require("express");
const cors = require("cors");
const { verifyToken } = require("./middleware/auth.middleware");

const app = express();

app.use(cors());
app.use(express.json());

// ─── Public routes (no auth required) ────────────────────────────────────────
const authRoutes = require("./modules/auth/routes/auth.routes");
app.use("/api/auth", authRoutes);

// ─── Apply JWT verification to all routes below this line ─────────────────────
// The frontend already sends Authorization: Bearer <token> on every request,
// so this is backward-compatible with all existing API calls.
app.use(verifyToken);

// ─── CRM ──────────────────────────────────────────────────────────────────────
const leadRoutes = require("./modules/crm/routes/Lead.route");
app.use("/api/leads", leadRoutes);

const clientRoutes = require("./modules/crm/routes/Client.route");
app.use("/api/clients", clientRoutes);

const followupRoutes = require("./modules/crm/routes/FollowUp.route");
app.use("/api/followup", followupRoutes);

const mettingRoutes = require("./modules/crm/routes/Metting.routes");
app.use("/api/metting", mettingRoutes);

const proposalRoutes = require("./modules/crm/routes/Proposal.route");
app.use("/api/proposal", proposalRoutes);

// ─── Proposal System ──────────────────────────────────────────────────────────
const BoqRoutes = require("./modules/proposal/routes/Boq.route");
app.use("/api/boq", BoqRoutes);

const Boq_itemRoutes = require("./modules/proposal/routes/Boq_item.route");
app.use("/api/boqitem", Boq_itemRoutes);

const TemplateRoutes = require("./modules/proposal/routes/Template_route");
app.use("/api/Template", TemplateRoutes);

const ApproveRoute = require("./modules/proposal/routes/Approval.Route");
app.use("/api/Approve", ApproveRoute);

const paymentRoutes = require("./modules/proposal/routes/Payment.Routes");
app.use("/api/payment", paymentRoutes);

const proposalVersionRoutes = require("./modules/proposal/routes/Proposalversion.Route");
app.use("/api/proposalversion", proposalVersionRoutes);

const activityRoutes = require("./modules/proposal/routes/Activity.route");
app.use("/api/activity", activityRoutes);

const esignRoutes = require("./modules/proposal/routes/Esign.route");
app.use("/api/esign", esignRoutes);

// ─── Settings & RBAC (admin only — guarded inside the route file) ─────────────
const rolesRoutes = require("./modules/settings/routes/Roles.route");
app.use("/api/roles", rolesRoutes);

module.exports = app;
