// Shared CRM lookup helpers. Lets tools accept either a MongoDB ObjectId
// OR a human-readable trackingId (CLI-YYYY-NNNN) — the model often picks up
// whichever it saw in the previous response, so we accept both.

const mongoose = require("mongoose");
const CRMClient = require("../../crm/models/CRMClient.model");

/**
 * Resolve a lead/client by either ObjectId, trackingId (CLI-YYYY-NNNN),
 * or an exact name match. Returns the document or null.
 *
 * Name resolution refuses if more than one active lead matches — the caller
 * should report the ambiguity to the user.
 *
 * @returns {Promise<{doc?: object, error?: string, candidates?: object[]}>}
 */
async function resolveLead(input) {
  if (!input) return { error: "No lead identifier provided." };
  const s = String(input).trim();
  if (!s) return { error: "No lead identifier provided." };

  // 1. ObjectId
  if (mongoose.isValidObjectId(s) && s.length === 24) {
    const doc = await CRMClient.findById(s).lean();
    return doc ? { doc } : { error: `No lead with id ${s}.` };
  }

  // 2. trackingId
  if (/^[A-Z]{2,5}-\d{4}-\d{4}$/i.test(s)) {
    const doc = await CRMClient.findOne({ trackingId: s.toUpperCase() }).lean();
    return doc ? { doc } : { error: `No lead with trackingId ${s}.` };
  }

  // 3. Name fragment (case-insensitive, contiguous match)
  const re = new RegExp(escapeRegex(s), "i");
  const candidates = await CRMClient.find({
    $or: [{ name: re }, { phone: re }, { email: re }],
  })
    .select("name trackingId phone email status")
    .limit(5)
    .lean();

  if (candidates.length === 0) return { error: `No lead matches "${s}".` };
  if (candidates.length === 1) return { doc: candidates[0] };
  return {
    error: `Ambiguous — ${candidates.length} leads match "${s}": ${candidates.map((c) => `${c.name} (${c.trackingId})`).join(", ")}. Be more specific.`,
    candidates,
  };
}

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

/**
 * Resolve a single Proposal. Two entry points:
 *   - proposalId: a 24-char ObjectId → loaded directly.
 *   - leadId: any lead identifier resolveLead accepts → finds that lead's
 *     proposals (optionally filtered by `status`). Exactly one → returns it;
 *     several → returns an ambiguity with the candidate list so the caller can
 *     ask which proposalId to use; none → not_found.
 *
 * Returns NON-lean Mongoose docs (write tools may .save()). leadId is populated
 * with name/email/phone/trackingId/assignedTo so callers can authorize + render.
 *
 * @returns {Promise<{doc?: object, lead?: object, error?: string, candidates?: object[]}>}
 */
async function resolveProposal({ proposalId, leadId } = {}, { status } = {}) {
  const Proposal = require("../../crm/models/Proposal.model");
  const LEAD_FIELDS = "name email phone trackingId assignedTo";

  if (proposalId) {
    const s = String(proposalId).trim();
    if (!mongoose.isValidObjectId(s) || s.length !== 24) {
      return { error: `"${s}" is not a valid proposal id.` };
    }
    const doc = await Proposal.findById(s).populate("leadId", LEAD_FIELDS);
    return doc ? { doc, lead: doc.leadId } : { error: `No proposal with id ${s}.` };
  }

  if (leadId) {
    const r = await resolveLead(leadId);
    if (r.error) return { error: r.error, candidates: r.candidates };
    const q = { leadId: r.doc._id };
    if (status) q.status = status;
    const proposals = await Proposal.find(q)
      .sort({ createdAt: -1 })
      .populate("leadId", LEAD_FIELDS)
      .limit(10);
    const statusNote = status ? ` with status "${status}"` : "";
    if (proposals.length === 0) {
      return { error: `No proposal${statusNote} found for "${r.doc.name}".`, lead: r.doc };
    }
    if (proposals.length === 1) return { doc: proposals[0], lead: proposals[0].leadId };
    return {
      error:
        `${proposals.length} proposals exist for "${r.doc.name}"${statusNote}: ` +
        proposals.map((p) => `"${p.title}" (${p.status}, id ${p._id})`).join("; ") +
        `. Specify which one by proposalId.`,
      lead: r.doc,
      candidates: proposals,
    };
  }

  return { error: "Provide a proposalId or a leadId." };
}

/**
 * Resolve a meeting by its ObjectId. Meetings don't carry a human-readable
 * tracking ID, so we only accept ObjectId here — callers should fetch via
 * getMeetings first to get an id.
 *
 * @returns {Promise<{doc?: object, error?: string}>}
 */
async function resolveMeeting(input) {
  if (!input) return { error: "No meeting identifier provided." };
  const s = String(input).trim();
  if (!s) return { error: "No meeting identifier provided." };
  if (!mongoose.isValidObjectId(s) || s.length !== 24) {
    return { error: `"${s}" is not a valid meeting id. Use getMeetings to find one.` };
  }
  const Meeting = require("../../crm/models/Metting.model");
  const doc = await Meeting.findById(s).lean();
  return doc ? { doc } : { error: `No meeting with id ${s}.` };
}

module.exports = { resolveLead, resolveProposal, resolveMeeting };
