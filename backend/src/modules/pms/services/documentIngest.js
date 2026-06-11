/**
 * documentIngest — auto-files client-approved documents that already exist in
 * the system into the project's Document Repository (ProjectDocument).
 *
 * Two ingestion points:
 *
 *   1. ingestProposalPdf  — on proposal → project initiation. The proposal has
 *      already passed client approval at that point (manager_approved → sent →
 *      esign_received → …), so its PDF is rendered and stored to S3 under the
 *      new project's repository ("Documents" category). Badge reflects how far
 *      the client got: "signed" once e-sign/payment happened, else "approved".
 *
 *   2. ingestApprovedDrawing — when a drawing is approved. The drawing file
 *      already lives in S3, so the repository entry REFERENCES the same object
 *      (bucket/key) instead of copying it ("Design Files" category).
 *
 * Both functions are idempotent (unique partial index on
 * { projectId, source, sourceRef.refId }) and designed to be called
 * fire-and-forget — they throw nothing at the caller beyond a rejected
 * promise, so wrap calls in .catch().
 */
const ProjectDocument = require("../models/ProjectDocument.model");
const s3Storage = require("./s3Storage");

// Proposal statuses at/after the client's e-sign — these earn the "signed" badge.
const CLIENT_SIGNED_STATUSES = [
  "esign_received", "payment_received", "project_ready", "project_started",
];

const isDuplicateKeyError = (err) => err && err.code === 11000;

/**
 * Render the approved proposal to PDF and file it in the project repository.
 *
 * @param {Object} args
 * @param {Object} args.project   lean/full Project doc — needs _id, trackingId, name
 * @param {Object} args.proposal  lean Proposal doc (content sections, totals, status)
 * @param {Object} args.client    lean CRMClient doc (proposal.leadId populated)
 * @param {string} [args.actorId] user who triggered the ingestion
 */
async function ingestProposalPdf({ project, proposal, client, actorId }) {
  if (!project?._id || !proposal?._id) return null;

  const exists = await ProjectDocument.findOne({
    projectId: project._id,
    source: "proposal",
    "sourceRef.refId": proposal._id,
  }).select("_id").lean();
  if (exists) return null;

  // Lazy-require: proposalPdf boots Puppeteer, keep it out of cold start.
  const { generateProposalPdfBuffer, saveProposalPdf } = require("../../crm/utils/proposalPdf");
  const buffer = await generateProposalPdfBuffer(proposal, client);

  const displayName = `Approved Proposal — ${proposal.title || client?.name || project.name}`;
  const fileName = `${(proposal.title || "proposal").replace(/[^a-zA-Z0-9_-]+/g, "_")}.pdf`;

  let fileUrl, s3Bucket, s3Key;
  if (s3Storage.isConfigured()) {
    const key = s3Storage.buildDocumentKey({
      projectTrackingId: project.trackingId,
      category: "documents",
      name: displayName,
      originalFilename: fileName,
    });
    const uploaded = await s3Storage.putObject({
      key,
      body: buffer,
      contentType: "application/pdf",
    });
    fileUrl  = uploaded.url;
    s3Bucket = uploaded.bucket;
    s3Key    = uploaded.key;
  } else {
    // Dev fallback without AWS credentials — persist to backend/public and
    // store the static URL so the repository still works end-to-end.
    const saved = await saveProposalPdf(buffer, proposal._id);
    fileUrl = saved.publicUrl;
  }

  const signed =
    CLIENT_SIGNED_STATUSES.includes(proposal.status) ||
    proposal.esignStatus === "signed" ||
    proposal.esign?.status === "signed";

  try {
    return await ProjectDocument.create({
      projectId:   project._id,
      name:        displayName,
      description: "Automatically filed when the project was initiated from this approved proposal.",
      category:    "documents",
      status:      signed ? "signed" : "approved",
      fileName,
      fileType:    "application/pdf",
      fileSize:    buffer.length,
      fileUrl,
      s3Bucket,
      s3Key,
      source:      "proposal",
      sourceRef:   { kind: "Proposal", refId: proposal._id },
      uploadedBy:  actorId || undefined,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) return null; // raced with another ingestion
    throw err;
  }
}

/**
 * File a client-approved drawing into the repository by referencing its
 * existing S3 object — no copy is made.
 *
 * @param {Object} args
 * @param {Object} args.drawing   Drawing doc (post-approval) — needs projectId,
 *                                title, version, fileUrl, fileName, s3 metadata
 * @param {string} [args.actorId] approver id
 */
async function ingestApprovedDrawing({ drawing, actorId }) {
  if (!drawing?._id || !drawing.projectId || !drawing.fileUrl) return null;

  const exists = await ProjectDocument.findOne({
    projectId: drawing.projectId,
    source: "drawing",
    "sourceRef.refId": drawing._id,
  }).select("_id").lean();
  if (exists) return null;

  // Resolve S3 metadata — same fallback chain as the drawing signed-URL path.
  let s3Bucket = drawing.s3Bucket;
  let s3Key    = drawing.s3Key;
  if (!s3Key) {
    const parsed = s3Storage.parseS3Url(drawing.fileUrl);
    if (parsed) ({ bucket: s3Bucket, key: s3Key } = parsed);
  }

  const version = Number(drawing.version) || 1;
  const zone = drawing.zoneName ? ` · ${drawing.zoneName}` : "";

  try {
    return await ProjectDocument.create({
      projectId:   drawing.projectId,
      name:        `${drawing.title || "Drawing"} (v${version})${zone}`,
      description: "Automatically filed when this drawing was approved.",
      category:    "design_files",
      status:      "approved",
      fileName:    drawing.fileName || undefined,
      fileType:    drawing.fileType || undefined,
      fileSize:    drawing.fileSize || undefined,
      fileUrl:     drawing.fileUrl,
      s3Bucket:    s3Bucket || undefined,
      s3Key:       s3Key || undefined,
      source:      "drawing",
      sourceRef:   { kind: "Drawing", refId: drawing._id },
      uploadedBy:  actorId || undefined,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) return null;
    throw err;
  }
}

module.exports = { ingestProposalPdf, ingestApprovedDrawing };
