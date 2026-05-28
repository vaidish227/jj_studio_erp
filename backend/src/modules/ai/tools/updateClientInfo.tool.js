// Write tool: enrich an existing CRM client with the detailed "Client Info Form"
// fields — DOB, anniversary, residential address, company, office address, spouse,
// children ages, and the structured site address (building / tower / unit / floor).
//
// This is the AI-tool mirror of `updateClientDetails` in
// crm/controllers/CRMClient.controller.js — the same controller the Client Info
// Form on the lead profile calls.
//
// Intentionally disjoint from `updateLead`:
//   - updateLead handles enquiry-level fields (name, phone, email, projectType,
//     area, budget, city, priority, notes, referredBy, referrerPhone, siteAddress
//     as a single free-text string)
//   - updateClientInfo handles the deeper personal/family/site-detail fields the
//     Client Info Form captures *after* the lead is qualified.
//
// Unknown fields are REJECTED (not silently dropped) — this is the bug we hit
// when updateLead silently swallowed `companyName` and then mis-reported
// "no changes" as "already set to <value>".

const CRMClient = require("../../crm/models/CRMClient.model");
const { resolveLead } = require("../utils/resolveCrm");

const WIDER_PERMS = ["*", "crm.update"];

// Detect obviously-fabricated values (same heuristics as updateLead).
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
  return PLACEHOLDER_EMAIL_DOMAINS.has(v.slice(at + 1).trim().toLowerCase());
}
function looksLikePlaceholderPhone(v) {
  if (typeof v !== "string") return false;
  return PLACEHOLDER_PHONE_RE.test(v.replace(/[^0-9xX]/g, ""));
}

// Allowed top-level args. Anything outside this list triggers an unsupported_field
// error rather than silently disappearing.
const ALLOWED_ARGS = new Set([
  "leadId",
  // personal
  "dob", "anniversary", "address", "companyName", "officeAddress",
  // spouse (flattened — model finds these natural; we re-nest before saving)
  "spouseName", "spousePhone", "spouseEmail", "spouseDob", "spouseAnniversary",
  // site address (flattened)
  "buildingName", "tower", "unit", "floor", "fullSiteAddress", "siteCity",
  // children
  "childrenAges",
]);

// Subset that updateLead already owns. If the caller passes these here, point
// them at the right tool instead of accepting partial updates.
const LEAD_LEVEL_FIELDS = new Set([
  "name", "phone", "email", "projectType", "area", "budget", "city",
  "priority", "notes", "referredBy", "referrerPhone", "siteAddress",
]);

// Parse YYYY-MM-DD or any ISO-compatible string into a Date.
// Returns { date } on success, { error } on invalid input.
function parseDate(v, label) {
  if (v == null || v === "") return { skip: true };
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    return { error: `"${v}" is not a valid date for ${label}. Use YYYY-MM-DD.` };
  }
  return { date: d };
}

async function loadAndAuthorize(args, ctx) {
  const r = await resolveLead(args.leadId);
  if (r.error) {
    return {
      error: {
        ok: false,
        error: r.candidates ? "ambiguous" : "not_found",
        summaryText: r.error,
        uiHint: "error",
        ...(r.candidates ? { candidates: r.candidates } : {}),
      },
    };
  }
  const lead = r.doc;
  const isOwner = String(lead.assignedTo || "") === String(ctx.userId);
  const elevated = (ctx.permissions || []).some((p) => WIDER_PERMS.includes(p));
  if (!isOwner && !elevated) {
    return {
      error: {
        ok: false,
        error: "denied",
        uiHint: "error",
        summaryText: "Only the assigned salesperson (or admin) can update this client's info.",
      },
    };
  }
  return { lead };
}

// Detect args the model passed but we don't accept. We split into "lead-level
// fields" (suggest the other tool) and "truly unknown" (refuse outright) so the
// model can self-correct.
function findRejectedArgs(args) {
  const unsupported = [];
  const wrongTool = [];
  for (const key of Object.keys(args)) {
    if (ALLOWED_ARGS.has(key)) continue;
    if (LEAD_LEVEL_FIELDS.has(key)) wrongTool.push(key);
    else unsupported.push(key);
  }
  return { unsupported, wrongTool };
}

// Build the $set / changes objects from the flat args. Empty / null / unchanged
// values are skipped (no accidental wipes). Returns:
//   { changes: <human-readable diff>, set: <Mongo update doc> }
// or { error: <error result object> } if a value fails validation.
function buildChanges(args, lead) {
  const changes = {};
  const set = {};

  // ── personal scalars ──
  for (const field of ["address", "companyName", "officeAddress"]) {
    if (!(field in args)) continue;
    const next = args[field];
    if (next === "" || next == null) continue;
    if (lead[field] === next) continue;
    changes[field] = next;
    set[field] = next;
  }

  // ── personal dates ──
  for (const [argKey, modelKey, label] of [
    ["dob", "dob", "date of birth"],
    ["anniversary", "anniversary", "anniversary"],
  ]) {
    if (!(argKey in args)) continue;
    const r = parseDate(args[argKey], label);
    if (r.skip) continue;
    if (r.error) {
      return {
        error: {
          ok: false,
          error: "invalid_value",
          uiHint: "error",
          summaryText: r.error,
        },
      };
    }
    const existing = lead[modelKey] ? new Date(lead[modelKey]).toISOString() : null;
    if (existing === r.date.toISOString()) continue;
    changes[modelKey] = r.date.toISOString().slice(0, 10);
    set[modelKey] = r.date;
  }

  // ── spouse (re-nest the flat args) ──
  const spouseInputs = {
    name:        "spouseName" in args ? args.spouseName : undefined,
    phone:       "spousePhone" in args ? args.spousePhone : undefined,
    email:       "spouseEmail" in args ? args.spouseEmail : undefined,
    dob:         "spouseDob" in args ? args.spouseDob : undefined,
    anniversary: "spouseAnniversary" in args ? args.spouseAnniversary : undefined,
  };
  if (Object.values(spouseInputs).some((v) => v !== undefined)) {
    if (looksLikePlaceholderEmail(spouseInputs.email)) {
      return {
        error: {
          ok: false, error: "placeholder_value", uiHint: "error",
          summaryText: `"${spouseInputs.email}" looks like a placeholder spouse email, not a real address.`,
        },
      };
    }
    if (looksLikePlaceholderPhone(spouseInputs.phone)) {
      return {
        error: {
          ok: false, error: "placeholder_value", uiHint: "error",
          summaryText: `"${spouseInputs.phone}" looks like a placeholder spouse phone.`,
        },
      };
    }

    const currentSpouse = lead.spouse || {};
    const nextSpouse = { ...currentSpouse };
    const spouseDiff = {};

    for (const k of ["name", "phone", "email"]) {
      if (spouseInputs[k] == null || spouseInputs[k] === "") continue;
      if (currentSpouse[k] === spouseInputs[k]) continue;
      nextSpouse[k] = spouseInputs[k];
      spouseDiff[k] = spouseInputs[k];
    }
    for (const [k, label] of [["dob", "spouse DOB"], ["anniversary", "anniversary"]]) {
      if (spouseInputs[k] == null || spouseInputs[k] === "") continue;
      const r = parseDate(spouseInputs[k], label);
      if (r.error) {
        return {
          error: {
            ok: false, error: "invalid_value", uiHint: "error",
            summaryText: r.error,
          },
        };
      }
      const existing = currentSpouse[k] ? new Date(currentSpouse[k]).toISOString() : null;
      if (existing === r.date.toISOString()) continue;
      nextSpouse[k] = r.date;
      spouseDiff[k] = r.date.toISOString().slice(0, 10);
    }

    if (Object.keys(spouseDiff).length > 0) {
      changes.spouse = spouseDiff;
      set.spouse = nextSpouse;
    }
  }

  // ── site address (structured) ──
  const siteInputs = {
    buildingName: "buildingName" in args ? args.buildingName : undefined,
    tower:        "tower" in args ? args.tower : undefined,
    unit:         "unit" in args ? args.unit : undefined,
    floor:        "floor" in args ? args.floor : undefined,
    fullAddress:  "fullSiteAddress" in args ? args.fullSiteAddress : undefined,
    city:         "siteCity" in args ? args.siteCity : undefined,
  };
  if (Object.values(siteInputs).some((v) => v !== undefined)) {
    const currentSite = lead.siteAddress || {};
    const nextSite = { ...currentSite };
    const siteDiff = {};
    for (const k of Object.keys(siteInputs)) {
      const v = siteInputs[k];
      if (v == null || v === "") continue;
      if (currentSite[k] === v) continue;
      nextSite[k] = v;
      siteDiff[k] = v;
    }
    if (Object.keys(siteDiff).length > 0) {
      changes.siteAddress = siteDiff;
      set.siteAddress = nextSite;
    }
  }

  // ── children (array of ages) ──
  if ("childrenAges" in args) {
    const ages = args.childrenAges;
    if (Array.isArray(ages)) {
      const cleaned = ages
        .map((a) => Number(a))
        .filter((a) => Number.isFinite(a) && a >= 0 && a <= 100);
      const currentAges = (lead.children || []).map((c) => c.age).filter((a) => a != null);
      const same = cleaned.length === currentAges.length
        && cleaned.every((a, i) => a === currentAges[i]);
      if (!same) {
        changes.children = cleaned.map((age) => ({ age }));
        set.children = cleaned.map((age) => ({ age }));
      }
    }
  }

  return { changes, set };
}

module.exports = {
  name: "updateClientInfo",
  permission: "crm.update",
  isWrite: true,
  description:
    "Update the detailed 'Client Info Form' fields on a CRM lead/client — date of birth, anniversary, residential address, company name, office address, spouse details (name/phone/email/DOB/anniversary), structured site address (building/tower/unit/floor/full address/city), and children's ages. Use this when the user says 'update client information', 'add company name', 'set DOB', 'spouse details', 'building/flat/floor number'. For basic enquiry fields (name, phone, email, project type, area, budget, city, priority, notes, referrer info, free-text site address) use `updateLead` instead. `leadId` accepts ObjectId, trackingId (CLI-YYYY-NNNN), or unambiguous name fragment.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      leadId: {
        type: "string",
        description: "Lead identifier — ObjectId, trackingId, or unambiguous name fragment.",
        minLength: 2,
        maxLength: 100,
      },
      dob:         { type: "string", description: "Date of birth in YYYY-MM-DD (or any ISO date). ONLY pass what the user gave." },
      anniversary: { type: "string", description: "Wedding anniversary in YYYY-MM-DD. ONLY pass what the user gave." },
      address:     { type: "string", maxLength: 300, description: "Residential address." },
      companyName: { type: "string", maxLength: 160 },
      officeAddress: { type: "string", maxLength: 300 },
      spouseName:  { type: "string", maxLength: 120 },
      spousePhone: { type: "string", minLength: 6, maxLength: 20, description: "ONLY pass what the user gave. No placeholders." },
      spouseEmail: { type: "string", maxLength: 120, description: "ONLY pass what the user gave. No placeholders." },
      spouseDob:   { type: "string", description: "Spouse DOB in YYYY-MM-DD." },
      spouseAnniversary: { type: "string", description: "Anniversary in YYYY-MM-DD (alias of `anniversary` — pass one or the other, not both)." },
      buildingName: { type: "string", maxLength: 160 },
      tower:        { type: "string", maxLength: 80 },
      unit:         { type: "string", maxLength: 80, description: "Flat / unit number." },
      floor:        { type: "string", maxLength: 40 },
      fullSiteAddress: { type: "string", maxLength: 300, description: "Complete street address of the project site." },
      siteCity:     { type: "string", maxLength: 80, description: "City on the site address record (separate from the lead's primary city — use updateLead for that)." },
      childrenAges: {
        type: "array",
        items: { type: "number", minimum: 0, maximum: 100 },
        description: "Ages of children, e.g. [4, 7]. Replaces the existing list.",
      },
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
        summaryText: `These fields belong to updateLead, not updateClientInfo: ${rejected.wrongTool.join(", ")}. Call updateLead for those.`,
      };
    }
    if (rejected.unsupported.length > 0) {
      return {
        ok: false,
        error: "unsupported_field",
        uiHint: "error",
        summaryText: `updateClientInfo does not support these fields: ${rejected.unsupported.join(", ")}. Don't claim they were saved.`,
      };
    }

    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;

    const built = buildChanges(args, r.lead);
    if (built.error) return built.error;
    const { changes } = built;

    if (Object.keys(changes).length === 0) {
      return {
        ok: false,
        error: "no_changes",
        uiHint: "error",
        summaryText: `No changes — every provided field already matches the client's stored value.`,
      };
    }

    const summary = Object.entries(changes)
      .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
      .join(", ");
    return {
      ok: true,
      proposalDescription: `Update client info for "${r.lead.name}" — ${summary}.`,
      args,
      preview: {
        leadName: r.lead.name,
        trackingId: r.lead.trackingId,
        changes,
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

    const built = buildChanges(args, r.lead);
    if (built.error) return built.error;
    const { changes, set } = built;

    if (Object.keys(changes).length === 0) {
      return {
        ok: false,
        error: "no_changes",
        uiHint: "error",
        summaryText: `No changes — every provided field already matches the client's stored value.`,
      };
    }

    // Mark client info complete on first detailed submission, mirroring
    // controller behavior (CRMClient.controller.js → updateClientDetails).
    const isFirstClientInfo = !r.lead.clientInfoCompleted;
    if (isFirstClientInfo) {
      set.clientInfoCompleted = true;
      set.clientInfoCompletedAt = new Date();
    }

    await CRMClient.updateOne(
      { _id: r.lead._id },
      {
        $set: set,
        $push: {
          interactionHistory: {
            type: "client_info",
            title: isFirstClientInfo
              ? "Client information submitted"
              : "Client information updated",
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
      summaryText: `Updated client info for "${r.lead.name}" — ${Object.keys(changes).join(", ")}.`,
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
