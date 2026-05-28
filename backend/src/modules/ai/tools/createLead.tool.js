// Write tool: create a new CRM lead (enquiry). Mirrors createClientEnquiry —
// validates required fields, checks duplicates by phone/email, and seeds the
// new doc with the same initial state (status='new', lifecycleStage='enquiry',
// plus the opening interactionHistory event).

const CRMClient = require("../../crm/models/CRMClient.model");
const { dispatch: notify } = require("../../notifications/services/notificationDispatcher");

const WIDER_PERMS = ["*", "crm.create", "crm.update"];

const PROJECT_TYPES = ["Residential", "Commercial"];
const SOURCES = ["walk_in", "referral", "website", "instagram", "whatsapp", "other"];
const PRIORITIES = ["high", "medium", "low"];

function authorize(ctx) {
  const ok = (ctx.permissions || []).some((p) => WIDER_PERMS.includes(p));
  if (!ok) {
    return {
      ok: false,
      error: "denied",
      summaryText: "You don't have permission to create new leads.",
      uiHint: "error",
    };
  }
  return null;
}

async function findDuplicate({ phone, email }) {
  const or = [{ phone }];
  if (email) or.push({ email });
  return CRMClient.findOne({ $or: or }).select("name trackingId phone email").lean();
}

module.exports = {
  name: "createLead",
  permission: "crm.create",
  isWrite: true,
  description:
    "Create a new CRM lead (enquiry). Use when the user says 'add a new lead', 'create lead for Ravi 98XXX residential Mumbai', 'log enquiry'. Requires name and phone; everything else optional. Refuses duplicates (same phone or email).",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      name:  { type: "string", minLength: 2, maxLength: 120 },
      phone: { type: "string", minLength: 6, maxLength: 20 },
      email: { type: "string", maxLength: 120 },
      projectType: { type: "string", enum: PROJECT_TYPES },
      area:   { type: "number", minimum: 0 },
      budget: { type: "number", minimum: 0 },
      city:   { type: "string", maxLength: 80 },
      source:   { type: "string", enum: SOURCES,    description: "How they reached us. Defaults to 'walk_in'." },
      priority: { type: "string", enum: PRIORITIES, description: "Defaults to 'medium'." },
      notes:    { type: "string", maxLength: 1000 },
      referredBy:    { type: "string", maxLength: 120 },
      referrerPhone: { type: "string", maxLength: 20 },
      siteAddress:   { type: "string", maxLength: 300, description: "Free-text site address." },
    },
    required: ["name", "phone"],
  },

  async dryRun(args, ctx) {
    const denied = authorize(ctx);
    if (denied) return denied;

    const dup = await findDuplicate(args);
    if (dup) {
      return {
        ok: false,
        error: "duplicate",
        summaryText: `A lead already exists with that phone/email — ${dup.name} (${dup.trackingId}).`,
        uiHint: "error",
        data: { existingId: String(dup._id), trackingId: dup.trackingId, name: dup.name },
      };
    }

    const labelParts = [
      args.projectType || "no project type",
      args.city || null,
      args.budget != null ? `₹${args.budget}` : null,
    ].filter(Boolean);

    return {
      ok: true,
      proposalDescription:
        `Create new lead "${args.name}" (${args.phone})${labelParts.length ? ` — ${labelParts.join(", ")}` : ""}.`,
      args,
      preview: {
        name: args.name,
        phone: args.phone,
        email: args.email || null,
        projectType: args.projectType || null,
        area: args.area || null,
        budget: args.budget || null,
        city: args.city || null,
        source: args.source || "walk_in",
        priority: args.priority || "medium",
      },
    };
  },

  async apply(args, ctx) {
    const denied = authorize(ctx);
    if (denied) return denied;

    const dup = await findDuplicate(args);
    if (dup) {
      return {
        ok: false,
        error: "duplicate",
        summaryText: `Refused — a lead already exists with that phone/email: ${dup.name} (${dup.trackingId}).`,
        uiHint: "error",
        data: { existingId: String(dup._id), trackingId: dup.trackingId, name: dup.name },
      };
    }

    const doc = {
      name: args.name,
      phone: args.phone,
      email: args.email || undefined,
      projectType: args.projectType,
      area: args.area,
      budget: args.budget,
      city: args.city,
      source: args.source || "walk_in",
      priority: args.priority || "medium",
      notes: args.notes,
      referredBy: args.referredBy,
      referrerPhone: args.referrerPhone,
      status: "new",
      lifecycleStage: "enquiry",
      whatsappSent: false,
      clientInfoCompleted: false,
      assignedTo: ctx.userId,
      interactionHistory: [
        {
          type: "status_change",
          title: "Enquiry captured",
          description: "Enquiry created via AI assistant and added to the CRM pipeline.",
        },
      ],
    };
    if (args.siteAddress) {
      doc.siteAddress = { fullAddress: args.siteAddress };
    }

    const lead = await CRMClient.create(doc);

    notify({
      type: "lead.created",
      module: "crm",
      priority: "high",
      title: `New lead: ${lead.name}`,
      message: `${lead.projectType || "Interior"} enquiry${lead.city ? ` from ${lead.city}` : ""} — created via AI assistant.`,
      link: `/crm/leads/${lead._id}`,
      actor: { _id: ctx.userId, name: ctx.userName || "AI Assistant" },
      notifyActor: true,
      relatedTo: { module: "crm", recordId: lead._id },
      metadata: {
        leadName: lead.name,
        trackingId: lead.trackingId,
        source: lead.source,
        viaAI: true,
      },
    });

    return {
      ok: true,
      summaryText: `Created lead "${lead.name}" (${lead.trackingId}).`,
      uiHint: "actionDone",
      data: {
        leadId: String(lead._id),
        trackingId: lead.trackingId,
        name: lead.name,
        phone: lead.phone,
        status: lead.status,
        url: `/crm/lead/${lead._id}`,
      },
    };
  },
};
