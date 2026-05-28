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

module.exports = { resolveLead, resolveMeeting };
