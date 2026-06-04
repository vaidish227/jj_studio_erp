/**
 * triggerService — the WHEN → IF → THEN engine.
 *
 *   processEvent()  — match active workflows for an event, evaluate their IF
 *                     conditions, run their THEN actions, and log the event.
 *   runAction()     — execute a single workflow action (also called by the
 *                     scheduler for delayed actions).
 *
 * Everything here is best-effort and isolated: a failing workflow/action logs
 * and continues; it never propagates back to the business request that emitted
 * the event (emission goes through kitEvents, which is fire-and-forget).
 */
const KitWorkflow     = require("../models/KitWorkflow.model");
const KitTriggerEvent = require("../models/KitTriggerEvent.model");
const KitEnrollment   = require("../models/KitEnrollment.model");
const KitScheduledJob = require("../models/KitScheduledJob.model");
const conditionEvaluator = require("./conditionEvaluator");
const campaignEngine     = require("./campaignEngine");
const dispatchService    = require("./dispatchService");
const variableResolver   = require("./variableResolver");
const notificationDispatcher = require("../../notifications/services/notificationDispatcher");

const UNIT_MS = { minutes: 60 * 1000, hours: 60 * 60 * 1000, days: 24 * 60 * 60 * 1000 };
const hasDelay = (d) => d && Number(d.value) > 0;
const delayMs  = (d) => (Number(d.value) || 0) * (UNIT_MS[d.unit] || UNIT_MS.days);

/**
 * runAction — execute one THEN action for a target entity.
 * @param {Object} action  { type, campaignId?, templateId?, channel?, params? }
 * @param {Object} target  { entityType, entityId, actor, workflowId }
 */
const runAction = async (action, target) => {
  const { entityType, entityId, actor, workflowId } = target;

  switch (action.type) {
    case "start_campaign":
      if (!action.campaignId) return;
      await campaignEngine.enroll({
        campaignId: action.campaignId,
        entityType, entityIds: [entityId], enrolledBy: actor,
      });
      return;

    case "stop_campaign": {
      if (!action.campaignId) return;
      const enr = await KitEnrollment.findOneAndUpdate(
        { campaignId: action.campaignId, entityType, entityId, status: "active" },
        { $set: { status: "stopped", nextFireAt: null } },
        { new: true }
      );
      if (enr) await KitScheduledJob.updateMany({ enrollmentId: enr._id, status: "pending" }, { $set: { status: "cancelled" } });
      return;
    }

    case "send_template":
      if (!action.templateId) return;
      await dispatchService.dispatch({
        entityType, entityId,
        channel: action.channel,
        templateId: action.templateId,
        workflowId,
      });
      return;

    case "notify": {
      // In-app notification to internal users. Title/message may use {{vars}}.
      const vars = await variableResolver.resolve(entityType, entityId).catch(() => ({}));
      const render = (t) => (t ? variableResolver.render(t, vars) : "");
      await notificationDispatcher.dispatch({
        type:    "kit.automation",
        module:  "system",
        title:   render(action.params?.title) || "KIT automation",
        message: render(action.params?.message),
        priority: action.params?.priority || "normal",
        recipients: action.params?.recipients || [],
        link:    action.params?.link,
        relatedTo: { module: "kit", recordId: entityId },
      });
      return;
    }

    default:
      console.warn("[kit.triggerService] unknown action type:", action.type);
  }
};

/** executeActions — run all of a workflow's actions, honouring per-action delay. */
const executeActions = async (workflow, target) => {
  for (const action of workflow.actions || []) {
    try {
      if (hasDelay(action.delay)) {
        // Defer: hand to the campaign scheduler as a one-off workflow action.
        await KitScheduledJob.create({
          workflowId: workflow._id,
          runAt: new Date(Date.now() + delayMs(action.delay)),
          status: "pending",
          action: {
            type: "workflow_action",
            actionData: action,
            entityType: target.entityType,
            entityId: target.entityId,
            actor: target.actor,
          },
        });
      } else {
        await runAction(action, { ...target, workflowId: workflow._id });
      }
    } catch (err) {
      console.error(`[kit.triggerService] action ${action.type} failed for wf ${workflow._id}:`, err.message);
    }
  }
};

/**
 * processEvent — main entry. Match → evaluate → execute → log.
 * @param {Object} evt { eventType, sourceModule, entityType, entityId, payload, actor }
 */
const processEvent = async (evt) => {
  const { eventType, sourceModule, entityType, entityId, payload = {}, actor } = evt;
  if (!eventType) return;

  const matched = [];
  try {
    const workflows = await KitWorkflow.find({ isActive: true, "trigger.event": eventType }).lean();

    if (workflows.length) {
      // Resolve entity variables once; merge with the event payload for conditions.
      const vars = await variableResolver.resolve(entityType, entityId).catch(() => ({}));
      const context = { ...payload, ...vars };

      for (const wf of workflows) {
        try {
          if (conditionEvaluator.evaluate(wf.conditions, context)) {
            await executeActions(wf, { entityType, entityId, actor: actorId(actor) });
            matched.push(wf._id);
          }
        } catch (err) {
          console.error(`[kit.triggerService] workflow ${wf._id} failed:`, err.message);
        }
      }
    }
  } catch (err) {
    console.error("[kit.triggerService] processEvent error:", err.message);
  }

  // Append-only audit (best-effort).
  try {
    await KitTriggerEvent.create({
      eventType, sourceModule, entityType, entityId, payload, matchedWorkflows: matched,
    });
  } catch (err) {
    console.error("[kit.triggerService] failed to log trigger event:", err.message);
  }
};

// Normalize an actor (req.user doc / id / undefined) to an ObjectId-ish value.
const actorId = (actor) => {
  if (!actor) return undefined;
  if (typeof actor === "object") return actor._id || undefined;
  return actor;
};

module.exports = { processEvent, runAction, executeActions };
