const express = require("express");
const cors = require("cors");
const path = require("path");
const { verifyToken } = require("./middleware/auth.middleware");

const app = express();

app.use(cors());
app.use(express.json());

// ─── Static public assets (no auth — WhatsApp providers fetch directly) ──────
// Generated proposal PDFs live under public/proposals/ and are served at
// /static/proposals/<file>.pdf so Maytapi/Twilio can pull them as media.
app.use("/static", express.static(path.join(__dirname, "..", "public")));

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

// ─── Mail module ──────────────────────────────────────────────────────────────
const mailRoutes = require("./modules/mail/routes/Mail.route");
app.use("/api/mail", mailRoutes);

// ─── WhatsApp module (replaces legacy whatspp module) ─────────────────────────
const whatsappRoutes = require("./modules/whatsapp/routes/WhatsApp.route");
app.use("/api/whatsapp", whatsappRoutes);

// ─── Communication settings ───────────────────────────────────────────────────
const commSettingsRoutes = require("./modules/communication/routes/CommSettings.route");
app.use("/api/communication/settings", commSettingsRoutes);

// ─── PMS (Project Management System) ─────────────────────────────────────────
const pmsProjectRoutes = require("./modules/pms/routes/Project.route");
app.use("/api/pms/project", pmsProjectRoutes);

const pmsProjectInitiationRoutes = require("./modules/pms/routes/ProjectInitiation.route");
app.use("/api/pms/project-initiation", pmsProjectInitiationRoutes);

const pmsAssignableUsersRoutes = require("./modules/auth/routes/AssignableUsers.route");
app.use("/api/pms/users", pmsAssignableUsersRoutes);

const pmsTaskRoutes = require("./modules/pms/routes/Task.route");
app.use("/api/pms/task", pmsTaskRoutes);

const pmsDrawingRoutes = require("./modules/pms/routes/Drawing.route");
app.use("/api/pms/drawing", pmsDrawingRoutes);

const pmsVendorRoutes = require("./modules/pms/routes/Vendor.route");
app.use("/api/pms/vendor", pmsVendorRoutes);

const pmsSiteLogRoutes = require("./modules/pms/routes/SiteLog.route");
app.use("/api/pms/sitelog", pmsSiteLogRoutes);

const pmsPurchaseOrderRoutes = require("./modules/pms/routes/PurchaseOrder.route");
app.use("/api/pms/po", pmsPurchaseOrderRoutes);

const pmsMaterialRoutes = require("./modules/pms/routes/Material.route");
app.use("/api/pms/material", pmsMaterialRoutes);

const pmsApprovalRoutes = require("./modules/pms/routes/Approval.route");
app.use("/api/pms/approval", pmsApprovalRoutes);

const pmsSiteVisitRoutes = require("./modules/pms/routes/SiteVisit.route");
app.use("/api/pms/sitevisit", pmsSiteVisitRoutes);

const pmsDashboardRoutes = require("./modules/pms/routes/PMSDashboard.route");
app.use("/api/pms/dashboard", pmsDashboardRoutes);

const pmsMilestoneRoutes = require("./modules/pms/routes/Milestone.route");
app.use("/api/pms/milestone", pmsMilestoneRoutes);

const pmsActivityLogRoutes = require("./modules/pms/routes/ActivityLog.route");
app.use("/api/pms/activity", pmsActivityLogRoutes);

const pmsWhatsAppGroupRoutes = require("./modules/pms/routes/WhatsAppGroup.route");
app.use("/api/pms/whatsapp-group", pmsWhatsAppGroupRoutes);

const pmsCalendarRoutes = require("./modules/pms/routes/Calendar.route");
app.use("/api/pms/calendar", pmsCalendarRoutes);

// ─── DDMS — Design & Drawing Management ──────────────────────────────────────
const designerDashboardRoutes = require("./modules/pms/routes/DesignerDashboard.route");
app.use("/api/pms/designer", designerDashboardRoutes);

const designCommentRoutes = require("./modules/pms/routes/DesignComment.route");
app.use("/api/pms/design-comments", designCommentRoutes);

const designRevisionRoutes = require("./modules/pms/routes/DesignRevisionRequest.route");
app.use("/api/pms/design-revisions", designRevisionRoutes);

// ─── Settings & RBAC (admin only — guarded inside the route file) ─────────────
const rolesRoutes = require("./modules/settings/routes/Roles.route");
app.use("/api/roles", rolesRoutes);

// ─── Notifications (in-app bell + inbox) ─────────────────────────────────────
const notificationRoutes = require("./modules/notifications/routes/Notification.route");
app.use("/api/notifications", notificationRoutes);

// ─── AI Assistant ────────────────────────────────────────────────────────────
const aiRoutes = require("./modules/ai/routes/ai.route");
app.use("/api/ai", aiRoutes);

module.exports = app;