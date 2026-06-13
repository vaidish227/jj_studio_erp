// Write tool: update basic fields on an existing CRM lead (name, phone,
// email, project info, budget, etc.). Does NOT change status — use
// updateLeadStatus for that. Does NOT delete data. Empty-string / null
// values are ignored so the model can't accidentally wipe fields.

const CRMClient = require("../../crm/models/CRMClient.model");
const { resolveLead } = require("../utils/resolveCrm");

const WIDER_PERMS = ["*", "crm.update"];
const PROJECT_TYPES = ["Residential", "Commercial"];
const PRIORITIES = ["high", "medium", "low"];

// Detect obviously-fabricated values so the model can't sneak placeholders
// past the user under the "tap Confirm" card. Real users do enter @gmail.com /
// @yahoo.com / company domains; we only block domains/values used as
// well-known example or filler text.
const PLACEHOLDER_EMAIL_DOMAINS = new Set([
  "example.com", "example.org", "example.net", "test.com", "foo.com",
  "bar.com", "domain.com", "sample.com", "placeholder.com", "email.com",
  "mail.com",
]);
const PLACEHOLDER_PHONE_RE = /^(?:0+|9+|x+|0123456789|1234567890)$/i;

function looksLikePlaceholderEmail(v) {
  if (typeof v !== "string") return false;
  const at = v.lastIndexOf("@");
  if (at < 0) return false;
  const domain = v.slice(at + 1).trim().toLowerCase();
  return PLACEHOLDER_EMAIL_DOMAINS.has(domain);
}
function looksLikePlaceholderPhone(v) {
  if (typeof v !== "string") return false;
  return PLACEHOLDER_PHONE_RE.test(v.replace(/[^0-9xX]/g, ""));
}

// Whitelisted fields the AI can update. Everything else is rejected to avoid
// silent damage to status, history, communicationLogs, etc.
const UPDATABLE_FIELDS = [
  "name", "phone", "email",
  "projectType", "area", "budget", "city",
  "priority", "notes",
  "referredBy", "referrerPhone",
];

// Fields that belong on the Client Info Form (updateClientInfo tool). If the
// model passes them here, point it at the right tool instead of silently
// dropping them — that silent drop was the root cause of the model later
// hallucinating "already set to <value>".
const CLIENT_INFO_FIELDS = new Set([
  "dob", "anniversary", "address", "companyName", "officeAddress",
  "spouseName", "spousePhone", "spouseEmail", "spouseDob", "spouseAnniversary",
  "buildingName", "tower", "unit", "floor", "fullSiteAddress", "siteCity",
  "childrenAges",
]);

const ALLOWED_ARGS = new Set([...UPDATABLE_FIELDS, "leadId", "siteAddress"]);

function findRejectedArgs(args) {
  const wrongTool = [];
  const unsupported = [];
  for (const key of Object.keys(args)) {
    if (ALLOWED_ARGS.has(key)) continue;
    if (CLIENT_INFO_FIELDS.has(key)) wrongTool.push(key);
    else unsupported.push(key);
  }
  return { wrongTool, unsupported };
}

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
    "Update BASIC enquiry fields on an existing CRM lead — name, phone, email (a.k.a. 'mail id' / 'email id' in Indian English), projectType, area, budget, city, priority, notes, referrer info, free-text site address. Use this for 'Nidhi ki mail id update karni hai', 'change Ravi's phone', 'update budget for lead X'. NOTE: 'mail id update' means updating the email field — it is NOT 'send mail' (which is unsupported). For DEEPER 'client information' fields — DOB, anniversary, residential address, company name, office address, spouse details, structured site address (building/tower/unit/floor), children's ages — use `updateClientInfo`, NOT this tool. Does NOT change funnel status (use updateLeadStatus). Ignores empty fields. `leadId` accepts ObjectId, trackingId, OR a name fragment — pass the name directly, no need to look up the id first.",
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
      name:  { type: "string", minLength: 2, maxLength: 120, description: "ONLY pass the value the user explicitly stated. Never invent." },
      phone: { type: "string", minLength: 6, maxLength: 20, description: "ONLY pass the value the user explicitly stated. Never invent placeholders like '0000000000' or 'XXXXXXXXXX' — if the user didn't give a phone, omit this field and ask them." },
      email: { type: "string", maxLength: 120, description: "ONLY pass the value the user explicitly stated. Never invent placeholders like 'nidhi@example.com', 'foo@bar.com', 'test@test.com' — if the user didn't give an email, omit this field and ask them first." },
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
    const rejected = findRejectedArgs(args);
    if (rejected.wrongTool.length > 0) {
      return {
        ok: false,
        error: "wrong_tool",
        uiHint: "error",
        summaryText: `These fields belong to updateClientInfo, not updateLead: ${rejected.wrongTool.join(", ")}. Call updateClientInfo for those.`,
      };
    }
    if (rejected.unsupported.length > 0) {
      return {
        ok: false,
        error: "unsupported_field",
        uiHint: "error",
        summaryText: `updateLead does not support these fields: ${rejected.unsupported.join(", ")}. Don't tell the user they were saved.`,
      };
    }

    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;

    if (looksLikePlaceholderEmail(args.email)) {
      return {
        ok: false,
        error: "placeholder_value",
        uiHint: "error",
        summaryText: `"${args.email}" looks like a placeholder, not a real email. Ask the user for the actual new email address.`,
      };
    }
    if (looksLikePlaceholderPhone(args.phone)) {
      return {
        ok: false,
        error: "placeholder_value",
        uiHint: "error",
        summaryText: `"${args.phone}" looks like a placeholder, not a real phone number. Ask the user for the actual new phone.`,
      };
    }

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
    const rejected = findRejectedArgs(args);
    if (rejected.wrongTool.length > 0 || rejected.unsupported.length > 0) {
      return {
        ok: false,
        error: rejected.wrongTool.length ? "wrong_tool" : "unsupported_field",
        uiHint: "error",
        summaryText: "Refused — unsupported or wrong-tool fields in apply payload.",
      };
    }

    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;

    if (looksLikePlaceholderEmail(args.email) || looksLikePlaceholderPhone(args.phone)) {
      return {
        ok: false,
        error: "placeholder_value",
        uiHint: "error",
        summaryText: "Refused — proposed value looks like a placeholder.",
      };
    }

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
