/**
 * Gate Enforcement Middleware — Phase 1
 *
 * Express middleware factories that reject requests with 409 when a workflow
 * gate / task dependency is not satisfied.
 *
 * The middleware is OPT-IN per route. Apply it on:
 *   - Task.submitTask  → require activity "task.submit"
 *   - Drawing.releaseDrawing → require activity "drawing.release"
 *   - PurchaseOrder.createPO → require activity "po.emit"
 *
 * The PM override permission (`tasks.override_gate`) is checked here too —
 * if present in user permissions AND request body provides `overrideReason`,
 * the gate is overridden via workflowEngine.overrideGate and the request proceeds.
 *
 * Backward compatibility: if WORKFLOW_ENGINE_V1 is not enabled (or the task
 * has no `dependsOn`/`gateStatus` set), the middleware skips with `next()`.
 */

const Task = require("../models/Task.model");
const ApprovalGate = require("../models/ApprovalGate.model");
const workflowEngine = require("../services/workflowEngine");

const ENGINE_ENABLED = String(process.env.WORKFLOW_ENGINE_V1 || "").toLowerCase() === "true";

/**
 * Internal: does the user hold the override permission?
 * Accepts the standard AuthContext shape (user.permissions: string[]).
 */
function hasOverride(req) {
  const perms = req?.user?.permissions || [];
  return perms.includes("*") || perms.includes("tasks.override_gate");
}

/**
 * Internal: resolve the taskId or projectId from req based on the activity.
 */
function resolveTaskIdFromRequest(req, taskIdParam = "id") {
  return req.params?.[taskIdParam] || req.body?.taskId || null;
}

/**
 * Internal: check a task. Returns the same shape as evaluateTaskAccess.
 */
async function checkTaskAccess(taskId) {
  return workflowEngine.evaluateTaskAccess(taskId);
}

/**
 * Factory: require that a task can proceed for the given activity.
 *
 * @param {Object} opts
 * @param {string} opts.activity             — "task.submit", "drawing.release", "po.emit"
 * @param {string} [opts.taskIdParam="id"]   — req.params key holding the task id
 * @param {string} [opts.errorCode="BLOCKED_BY_GATE"]
 */
function requireTaskAccess({
  activity,
  taskIdParam = "id",
  errorCode = "BLOCKED_BY_GATE",
} = {}) {
  return async function gateEnforcementMiddleware(req, res, next) {
    try {
      if (!ENGINE_ENABLED) return next();

      const taskId = resolveTaskIdFromRequest(req, taskIdParam);
      if (!taskId) return next(); // can't evaluate; let controller handle

      const access = await checkTaskAccess(taskId);
      if (access.canStart) return next();

      // Currently blocked. Check override.
      const overrideReason = (req.body?.overrideReason || "").trim();
      if (hasOverride(req) && overrideReason) {
        // Override any open gates that hold this task.
        for (const g of access.openGates) {
          await workflowEngine.overrideGate(g._id, {
            actorId: req.user?._id,
            overrideReason,
          });
        }
        // Also flip the task status from "blocked" so the controller can proceed
        if (access.task.status === "blocked") {
          await Task.findByIdAndUpdate(taskId, {
            status: "not_started",
            gateStatus: "overridden",
          });
        }
        return next();
      }

      // Pick the most informative error code
      let code = errorCode;
      const reasons = [];
      if (access.unmetDeps.length) {
        code = "BLOCKED_BY_DEPENDENCY";
        reasons.push(
          ...access.unmetDeps.map((d) => ({
            taskId: d._id,
            title: d.title,
            taskType: d.taskType,
            currentStatus: d.status,
            requiredStatus: "approved",
          }))
        );
      }
      const gateReasons = access.openGates.map((g) => ({
        gateId: g._id,
        key: g.key,
        gateType: g.gateType,
        label: g.label,
        approverType: g.approverType,
        listensTo: g.listensTo,
      }));

      // If gates are open AND deps unmet, prefer dependency code
      // (you must clear deps before approvals make sense).
      return res.status(409).json({
        code,
        message: `Activity "${activity}" is blocked.`,
        unmetDependencies: reasons,
        openGates: gateReasons,
        canOverride: hasOverride(req),
      });
    } catch (err) {
      console.error("[gateEnforcement]", err);
      // Fail-open: if the engine errors, do not block the user. Log + continue.
      return next();
    }
  };
}

/**
 * Project-level gate check (for activities that aren't bound to a single task,
 * e.g. po.emit which references a vendor/task pair). The middleware looks for
 * an open ApprovalGate on the project with the given activity in blockedActivities.
 *
 * `projectIdResolver` may be sync OR async. For drawing.release, the resolver
 * loads the Drawing doc and returns its projectId.
 */
function requireProjectActivityAllowed({
  activity,
  projectIdResolver = (req) => req.params?.projectId || req.body?.projectId,
  errorCode = "BLOCKED_BY_CLIENT_APPROVAL",
} = {}) {
  return async function projectGateMiddleware(req, res, next) {
    try {
      if (!ENGINE_ENABLED) return next();

      const projectId = await projectIdResolver(req);
      if (!projectId) return next();

      const openGates = await ApprovalGate.find({
        projectId,
        status: "open",
        blockedActivities: activity,
      })
        .select("_id key gateType label approverType listensTo")
        .lean();

      if (openGates.length === 0) return next();

      const overrideReason = (req.body?.overrideReason || "").trim();
      if (hasOverride(req) && overrideReason) {
        for (const g of openGates) {
          await workflowEngine.overrideGate(g._id, {
            actorId: req.user?._id,
            overrideReason,
          });
        }
        return next();
      }

      return res.status(409).json({
        code: errorCode,
        message: `Activity "${activity}" is blocked by ${openGates.length} approval gate(s).`,
        openGates,
        canOverride: hasOverride(req),
      });
    } catch (err) {
      console.error("[gateEnforcement:project]", err);
      return next();
    }
  };
}

module.exports = {
  requireTaskAccess,
  requireProjectActivityAllowed,
  ENGINE_ENABLED,
};
