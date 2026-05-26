// Tools registry — single source of truth for tool definitions.
// Each tool module exports { name, description, parameters, permission, handler }.
// The registry adapts these into the OpenAI tools-function schema and filters
// by caller permissions so the model only sees tools the user is allowed to invoke.

const getMyTasks          = require("../tools/getMyTasks.tool");
const getTaskDetails      = require("../tools/getTaskDetails.tool");
const getOverdueTasks     = require("../tools/getOverdueTasks.tool");
const getChecklist        = require("../tools/getChecklist.tool");
const getProjectSummary   = require("../tools/getProjectSummary.tool");
const getDesignerDashboard = require("../tools/getDesignerDashboard.tool");

const TOOLS = [
  getMyTasks,
  getTaskDetails,
  getOverdueTasks,
  getChecklist,
  getProjectSummary,
  getDesignerDashboard,
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
