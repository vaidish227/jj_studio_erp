// Write tool: assign a CRM lead to a salesperson. Accepts user id OR name fragment.

const mongoose = require("mongoose");
const CRMClient = require("../../crm/models/CRMClient.model");
const User = require("../../auth/models/user.model");
const { resolveLead } = require("../utils/resolveCrm");

async function resolveAssignee(args) {
  if (args.toUserId && mongoose.isValidObjectId(args.toUserId)) {
    const u = await User.findById(args.toUserId).select("name email role isActive").lean();
    return u && u.isActive !== false ? { user: u } : { error: "User not found or inactive." };
  }
  if (args.toUserName?.trim()) {
    const term = String(args.toUserName).trim().slice(0, 60);
    const re = new RegExp(escapeRegex(term), "i");
    const cands = await User.find({
      isActive: { $ne: false },
      $or: [{ name: re }, { email: re }],
    }).select("name email role").limit(5).lean();
    if (cands.length === 0) return { error: `No active user matches "${term}".` };
    if (cands.length > 1) {
      return { error: `Ambiguous — matches ${cands.length} users: ${cands.map(c => c.name).join(", ")}. Be more specific.` };
    }
    return { user: cands[0] };
  }
  return { error: "Provide toUserId or toUserName." };
}

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

async function loadAndAuthorize(args) {
  const r = await resolveLead(args.leadId);
  if (r.error) {
    return { error: { ok: false, error: r.candidates ? "ambiguous" : "not_found", summaryText: r.error } };
  }
  const lead = r.doc;

  const a = await resolveAssignee(args);
  if (a.error) return { error: { ok: false, error: "invalid_args", summaryText: a.error } };
  if (String(lead.assignedTo || "") === String(a.user._id)) {
    return { error: { ok: false, error: "no_op",
      summaryText: `Lead is already assigned to ${a.user.name}.` } };
  }
  return { lead, toUser: a.user };
}

module.exports = {
  name: "assignLead",
  permission: "crm.update",
  isWrite: true,
  description:
    "Assign (or reassign) a CRM lead to a salesperson. Pass toUserId (preferred) or toUserName as a fragment — refuses on ambiguous matches.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      leadId: {
        type: "string",
        description: "Lead identifier — accepts ObjectId, trackingId (CLI-YYYY-NNNN), or an unambiguous name fragment.",
        minLength: 2,
        maxLength: 100,
      },
      toUserId:   { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
      toUserName: { type: "string", minLength: 2, maxLength: 60 },
    },
    required: ["leadId"],
  },

  async dryRun(args) {
    const r = await loadAndAuthorize(args);
    if (r.error) return r.error;
    return {
      ok: true,
      proposalDescription:
        `Assign lead "${r.lead.name}" to ${r.toUser.name} (${r.toUser.role})`,
      args: { ...args, toUserId: String(r.toUser._id) },
      preview: {
        leadName: r.lead.name,
        toUser: { id: String(r.toUser._id), name: r.toUser.name, role: r.toUser.role },
        fromUserId: r.lead.assignedTo ? String(r.lead.assignedTo) : null,
      },
    };
  },

  async apply(args) {
    const r = await loadAndAuthorize(args);
    if (r.error) return r.error;
    await CRMClient.updateOne(
      { _id: r.lead._id },
      { $set: { assignedTo: new mongoose.Types.ObjectId(r.toUser._id) } }
    );
    return {
      ok: true,
      summaryText: `Assigned lead "${r.lead.name}" to ${r.toUser.name}.`,
      uiHint: "actionDone",
      data: { leadId: String(r.lead._id), name: r.lead.name,
              assignee: { id: String(r.toUser._id), name: r.toUser.name } },
    };
  },
};
