// Tools registry — single source of truth for tool definitions.
// Each tool module exports { name, description, parameters, permission, handler }.
// The registry adapts these into the OpenAI tools-function schema and filters
// by caller permissions so the model only sees tools the user is allowed to invoke.

const getMyTasks           = require("../tools/getMyTasks.tool");
const getTaskDetails       = require("../tools/getTaskDetails.tool");
const getOverdueTasks      = require("../tools/getOverdueTasks.tool");
const getChecklist         = require("../tools/getChecklist.tool");
const getProjectSummary    = require("../tools/getProjectSummary.tool");
const getDesignerDashboard = require("../tools/getDesignerDashboard.tool");
// V2.1 additions
const getLeads             = require("../tools/getLeads.tool");
const getClients           = require("../tools/getClients.tool");
const getMeetings          = require("../tools/getMeetings.tool");
const listProposalTemplates = require("../tools/listProposalTemplates.tool");
const searchProjects       = require("../tools/searchProjects.tool");
const searchActivity       = require("../tools/searchActivity.tool");
// V3 write tools (two-phase: dryRun -> user confirm -> apply)
const updateTaskStatus     = require("../tools/updateTaskStatus.tool");
const toggleChecklistItem  = require("../tools/toggleChecklistItem.tool");
const reassignTask         = require("../tools/reassignTask.tool");
const requestTaskRevision  = require("../tools/requestTaskRevision.tool");
const addTaskNote          = require("../tools/addTaskNote.tool");
// V3.2 — drawings, CRM, and project write tools
const approveDrawing        = require("../tools/approveDrawing.tool");
const rejectDrawing         = require("../tools/rejectDrawing.tool");
const releaseDrawing        = require("../tools/releaseDrawing.tool");
const updateLeadStatus      = require("../tools/updateLeadStatus.tool");
const addFollowUp           = require("../tools/addFollowUp.tool");
const assignLead            = require("../tools/assignLead.tool");
const addLeadNote           = require("../tools/addLeadNote.tool");
const scheduleMeeting       = require("../tools/scheduleMeeting.tool");
const sendProposal          = require("../tools/sendProposal.tool");
const createAndSendProposal = require("../tools/createAndSendProposal.tool");
const updateProjectStatus   = require("../tools/updateProjectStatus.tool");
const updateClientApproval  = require("../tools/updateClientApproval.tool");
// Phase 1 — Dashboard read tools
const getDashboardStats     = require("../tools/getDashboardStats.tool");
const getSalesPipeline      = require("../tools/getSalesPipeline.tool");
const getDashboardFollowUps = require("../tools/getDashboardFollowUps.tool");
// Phase 2A — CRM Leads (read + write)
const getLeadDetails        = require("../tools/getLeadDetails.tool");
const createLead            = require("../tools/createLead.tool");
const updateLead            = require("../tools/updateLead.tool");
const convertLead           = require("../tools/convertLead.tool");
const recordAdvancePayment  = require("../tools/recordAdvancePayment.tool");

const TOOLS = [
  // Read
  getMyTasks,
  getTaskDetails,
  getOverdueTasks,
  getChecklist,
  getProjectSummary,
  getDesignerDashboard,
  getLeads,
  getClients,
  getMeetings,
  listProposalTemplates,
  searchProjects,
  searchActivity,
  // Write — task lifecycle
  updateTaskStatus,
  toggleChecklistItem,
  reassignTask,
  requestTaskRevision,
  addTaskNote,
  // Write — drawings
  approveDrawing,
  rejectDrawing,
  releaseDrawing,
  // Write — CRM
  updateLeadStatus,
  addFollowUp,
  assignLead,
  addLeadNote,
  scheduleMeeting,
  sendProposal,
  createAndSendProposal,
  // Write — project
  updateProjectStatus,
  updateClientApproval,
  // Read — Dashboard (Phase 1)
  getDashboardStats,
  getSalesPipeline,
  getDashboardFollowUps,
  // CRM Leads — read (Phase 2A)
  getLeadDetails,
  // CRM Leads — write (Phase 2A)
  createLead,
  updateLead,
  convertLead,
  recordAdvancePayment,
];

const byName = new Map(TOOLS.map((t) => [t.name, t]));

function hasPermission(permissions = [], required) {
  if (!required) return true;
  if (permissions.includes("*")) return true;
  return permissions.includes(required);
}

function get(name) {
  return byName.get(name) || null;
}

function listAvailable(userPermissions = []) {
  return TOOLS.filter((t) => hasPermission(userPermissions, t.permission));
}

/**
 * Produce the OpenAI `tools` array (function-calling schema) restricted to the
 * tools the user has permission to call.
 */
function openaiSchema(userPermissions = []) {
  return listAvailable(userPermissions).map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters || { type: "object", properties: {} },
    },
  }));
}

module.exports = { get, listAvailable, openaiSchema, hasPermission, TOOLS };
