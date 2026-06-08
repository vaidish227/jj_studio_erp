/**
 * variableResolver — turns an entity reference into a flat `{{variable}}` map
 * for KIT template rendering, plus sample values for editor preview.
 *
 * Public API:
 *   resolve(entityType, entityId) -> Promise<{ [key]: string }>   // real data
 *   sampleValues()                -> { [key]: string }            // preview defaults
 *   render(text, variables)       -> string                       // reuses mail renderTemplate
 *
 * Resolution is best-effort: any token that can't be resolved is simply omitted,
 * and the existing renderTemplate() leaves unresolved `{{tokens}}` intact.
 */
const { renderTemplate } = require("../../mail/service/mail.service");

// ── formatting helpers ───────────────────────────────────────────────────────
const fmtDate = (d) => {
  if (!d) return undefined;
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
    }).format(new Date(d));
  } catch {
    return undefined;
  }
};

const fmtCurrency = (n) => {
  if (n === undefined || n === null || n === "") return undefined;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency", currency: "INR", maximumFractionDigits: 0,
    }).format(Number(n));
  } catch {
    return undefined;
  }
};

const firstWord = (s) => (typeof s === "string" ? s.trim().split(/\s+/)[0] : undefined);

// Drop undefined/null/empty so renderTemplate leaves those tokens untouched.
const clean = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== "") out[k] = String(v);
  }
  return out;
};

const COMPANY = { company_name: "JJ Studio" };

// ── per-entity resolvers ─────────────────────────────────────────────────────
const resolveLead = async (id) => {
  const CRMClient = require("../../crm/models/CRMClient.model");
  const lead = await CRMClient.findById(id).lean();
  if (!lead) return {};

  const out = {
    client_name:  lead.name,
    first_name:   firstWord(lead.name),
    phone:        lead.phone,
    email:        lead.email,
    city:         lead.city,
    project_type: lead.projectType,
  };

  // Best-effort latest meeting / follow-up dates for this lead.
  try {
    const Meeting = require("../../crm/models/Metting.model");
    const m = await Meeting.findOne({ leadId: id }).sort({ date: -1 }).lean();
    if (m?.date) out.meeting_date = fmtDate(m.date);
  } catch { /* model shape may differ — skip */ }
  try {
    const FollowUp = require("../../crm/models/FollowUp.model");
    const f = await FollowUp.findOne({ leadId: id }).sort({ date: -1 }).lean();
    if (f?.date) out.followup_date = fmtDate(f.date);
  } catch { /* skip */ }

  return out;
};

const resolveClient = async (id) => {
  const Client = require("../../crm/models/Client.model");
  const c = await Client.findById(id).lean();
  if (!c) return {};
  return {
    client_name: c.name,
    first_name:  firstWord(c.name),
    phone:       c.phone,
    email:       c.email,
    city:        c.city,
  };
};

const resolveProposal = async (id) => {
  const Proposal = require("../../crm/models/Proposal.model");
  const p = await Proposal.findById(id).populate("leadId", "name projectType").lean();
  if (!p) return {};
  const lead = p.leadId && typeof p.leadId === "object" ? p.leadId : null;
  return {
    // No human proposal number exists on the model — derive a stable short ref.
    proposal_number: "PROP-" + String(p._id).slice(-6).toUpperCase(),
    proposal_amount: fmtCurrency(p.totalAmount || p.finalAmount),
    proposal_status: p.status,
    client_name:     lead?.name,
    first_name:      firstWord(lead?.name),
    project_type:    lead?.projectType,
  };
};

const resolveProject = async (id) => {
  const Project = require("../../pms/models/Project.model");
  const pr = await Project.findById(id).populate("clientId", "name").lean();
  if (!pr) return {};
  const client = pr.clientId && typeof pr.clientId === "object" ? pr.clientId : null;

  const out = {
    project_name:     pr.name,
    project_phase:    pr.phase,
    project_progress: pr.progressPercent !== undefined ? `${pr.progressPercent}%` : undefined,
    client_name:      client?.name,
    first_name:       firstWord(client?.name),
  };

  try {
    const SiteVisit = require("../../pms/models/SiteVisit.model");
    const sv = await SiteVisit.findOne({ projectId: id }).sort({ visitDate: -1 }).lean();
    if (sv?.visitDate) out.site_visit_date = fmtDate(sv.visitDate);
  } catch { /* skip */ }
  try {
    const Milestone = require("../../pms/models/ProjectMilestone.model");
    const ms = await Milestone.findOne({ projectId: id }).sort({ dueDate: -1 }).lean();
    if (ms?.title) out.milestone_name = ms.title;
  } catch { /* skip */ }

  return out;
};

const RESOLVERS = {
  lead:     resolveLead,
  client:   resolveClient,
  proposal: resolveProposal,
  project:  resolveProject,
};

/**
 * resolve — real variable map for a given entity. Always includes company vars.
 */
const resolve = async (entityType, entityId) => {
  const fn = RESOLVERS[entityType];
  if (!fn || !entityId) return { ...COMPANY };
  try {
    const vars = await fn(entityId);
    return { ...COMPANY, ...clean(vars) };
  } catch (err) {
    console.error(`[kit.variableResolver] ${entityType}/${entityId}:`, err.message);
    return { ...COMPANY };
  }
};

/**
 * resolveContact — raw delivery coordinates for an entity (no formatting).
 * Used by dispatchService to address WhatsApp (phone) / Email (email).
 * Returns { phone?, email? }.
 */
const resolveContact = async (entityType, entityId) => {
  if (!entityId) return {};
  try {
    if (entityType === "lead") {
      const CRMClient = require("../../crm/models/CRMClient.model");
      const d = await CRMClient.findById(entityId).select("phone email").lean();
      return d ? { phone: d.phone, email: d.email } : {};
    }
    if (entityType === "client") {
      const Client = require("../../crm/models/Client.model");
      const d = await Client.findById(entityId).select("phone email").lean();
      return d ? { phone: d.phone, email: d.email } : {};
    }
    if (entityType === "proposal") {
      const Proposal = require("../../crm/models/Proposal.model");
      const d = await Proposal.findById(entityId).populate("leadId", "phone email").lean();
      const lead = d?.leadId && typeof d.leadId === "object" ? d.leadId : null;
      return lead ? { phone: lead.phone, email: lead.email } : {};
    }
    if (entityType === "project") {
      const Project = require("../../pms/models/Project.model");
      const d = await Project.findById(entityId).populate("clientId", "phone email").lean();
      const client = d?.clientId && typeof d.clientId === "object" ? d.clientId : null;
      return client ? { phone: client.phone, email: client.email } : {};
    }
  } catch (err) {
    console.error(`[kit.resolveContact] ${entityType}/${entityId}:`, err.message);
  }
  return {};
};

/**
 * sampleValues — illustrative defaults so the editor preview always renders.
 */
const sampleValues = () => ({
  client_name:      "Asha Mehta",
  first_name:       "Asha",
  phone:            "+91 98765 43210",
  email:            "asha@example.com",
  city:             "Bengaluru",
  project_type:     "Residential",
  meeting_date:     "12 Jun 2026, 04:00 PM",
  followup_date:    "15 Jun 2026, 10:00 AM",
  proposal_number:  "PROP-1A2B3C",
  proposal_amount:  "₹12,50,000",
  proposal_status:  "sent",
  project_name:     "Skyline 3BHK Interiors",
  project_phase:    "design",
  project_progress: "40%",
  site_visit_date:  "18 Jun 2026, 11:00 AM",
  milestone_name:   "Design Sign-off",
  company_name:     "JJ Studio",
});

module.exports = { resolve, resolveContact, sampleValues, render: renderTemplate };
