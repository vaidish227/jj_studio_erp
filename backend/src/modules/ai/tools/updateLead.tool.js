// Write tool: update basic fields on an existing CRM lead (name, phone,
// email, project info, budget, etc.). Does NOT change status — use
// updateLeadStatus for that. Does NOT delete data. Empty-string / null
// values are ignored so the model can't accidentally wipe fields.

const CRMClient = require("../../crm/models/CRMClient.model");
const { resolveLead } = require("../utils/resolveCrm");

const WIDER_PERMS = ["*", "crm.update"];
const PROJECT_TYPES = ["Residential", "Commercial"];
const PRIORITIES = ["high", "medium", "low"];

// Whitelisted fields the AI can update. Everything else is rejected to avoid
// silent damage to status, history, communicationLogs, etc.
const UPDATABLE_FIELDS = [
  "name", "phone", "email",
  "projectType", "area", "budget", "city",
  "priority", "notes",
  "referredBy", "referrerPhone",
];

async function loadAndAuthorize(args, ctx) {
  const r = await resolveLead(args.leadId);
  if (r.error) {
    return { error: { ok: false, error: r.candidates ? "ambiguous" : "not_found", summaryText: r.error, uiHint: "error" } };
  }
  const lead = r.doc;
  const isOwner = String(lead.assignedTo || "") === String(ctx.userId);
  const elevated = (ctx.permissions || []).some((p) => WIDER_PERMS.includes(p));
  if (!isOwner && !elevated) {
    return { error: { ok: false, error: "denied", uiHint: "error",
      summaryText: "Only the assigned salesperson (or admin) can update this lead." } };
  }
  return { lead };
}

function pickChanges(args, lead) {
  const changes = {};
  for (const field of UPDATABLE_FIELDS) {
    if (!(field in args)) continue;
    const next = args[field];
    if (next === "" || next == null) continue;
    if (lead[field] === next) continue;
    changes[field] = next;
  }
  if (args.siteAddress != null && args.siteAddress !== "") {
    const nextSite = { ...(lead.siteAddress || {}), fullAddress: args.siteAddress };
    if (JSON.stringify(nextSite) !== JSON.stringify(lead.siteAddress)) {
      changes.siteAddress = nextSite;
    }
  }
  return changes;
}

module.exports = {
  name: "updateLead",
  permission: "crm.update",
  isWrite: true,
  description:
    "Update basic fields on an existing CRM lead — name, phone, email, projectType, area, budget, city, priority, notes, referrer info, site address. Does NOT change funnel status (use updateLeadStatus). Ignores empty fields so you can pass only what's changing.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      leadId: {
        type: "string",
        description: "Lead identifier — ObjectId, trackingId (CLI-YYYY-NNNN), or unambiguous name fragment.",
        minLength: 2,
        maxLength: 100,
      },
      name:  { type: "string", minLength: 2, maxLength: 120 },
      phone: { type: "string", minLength: 6, maxLength: 20 },
      email: { type: "string", maxLength: 120 },
      projectType: { type: "string", enum: PROJECT_TYPES },
      area:   { type: "number", minimum: 0 },
      budget: { type: "number", minimum: 0 },
      city:   { type: "string", maxLength: 80 },
      priority: { type: "string", enum: PRIORITIES },
      notes:    { type: "string", maxLength: 1000 },
      referredBy:    { type: "string", maxLength: 120 },
      referrerPhone: { type: "string", maxLength: 20 },
      siteAddress:   { type: "string", maxLength: 300 },
    },
    required: ["leadId"],
  },

  async dryRun(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;

    const changes = pickChanges(args, r.lead);
    if (Object.keys(changes).length === 0) {
      return {
        ok: false,
        error: "no_changes",
        summaryText: `No changes — every provided field matches the current lead.`,
        uiHint: "error",
      };
    }

    const summary = Object.entries(changes)
      .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
      .join(", ");
    return {
      ok: true,
      proposalDescription: `Update lead "${r.lead.name}" — ${summary}.`,
      args,
      preview: {
        leadName: r.lead.name,
        trackingId: r.lead.trackingId,
        changes,
        before: Object.fromEntries(Object.keys(changes).map((k) => [k, r.lead[k]])),
      },
    };
  },

  async apply(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;

    const changes = pickChanges(args, r.lead);
    if (Object.keys(changes).length === 0) {
      return {
        ok: false,
        error: "no_changes",
        summaryText: `No changes — every provided field matches the current lead.`,
        uiHint: "error",
      };
    }

    await CRMClient.updateOne(
      { _id: r.lead._id },
      {
        $set: changes,
        $push: {
          interactionHistory: {
            type: "note",
            title: "Lead details updated",
            description: `Updated via AI assistant: ${Object.keys(changes).join(", ")}.`,
            metadata: { changes },
            createdAt: new Date(),
          },
        },
        $currentDate: { lastInteractionAt: true },
      }
    );

    return {
      ok: true,
      summaryText: `Updated lead "${r.lead.name}" — ${Object.keys(changes).join(", ")}.`,
      uiHint: "actionDone",
      data: {
        leadId: String(r.lead._id),
        trackingId: r.lead.trackingId,
        name: r.lead.name,
        changedFields: Object.keys(changes),
        url: `/crm/lead/${r.lead._id}`,
      },
    };
  },
};
