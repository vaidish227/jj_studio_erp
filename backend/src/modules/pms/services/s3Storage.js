/**
 * s3Storage — thin wrapper around @aws-sdk/client-s3 for drawing uploads.
 *
 * Folder layout (browsable in AWS Console):
 *
 *   <bucket>/
 *   └── <prefix>/                              S3_DRAWINGS_PREFIX, default "drawings"
 *       └── <projectTrackingId>/                e.g. PRJ-2026-0003
 *           └── <zoneSlug>/                     e.g. master-bedroom
 *               └── <designSlug>-v<n>-<ts>.<ext>
 *
 * Why this layout:
 *   - Project ID is human-readable so admins can drill into a specific job.
 *   - Zone groups every drawing for one physical area together.
 *   - Filename carries the design name + version + timestamp so the file is
 *     self-describing if it's ever downloaded out of the ERP context.
 *
 * Env vars required:
 *   AWS_REGION             e.g. ap-south-1
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 *   S3_BUCKET              e.g. jjstudio-erp
 *   S3_DRAWINGS_PREFIX     optional, default "drawings"
 *
 * If S3 is not configured (bucket env missing), `isConfigured()` returns false
 * and the controller falls back to URL-only uploads (legacy behaviour) so the
 * app keeps working in dev without AWS credentials.
 */

const {
  S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const REGION = process.env.AWS_REGION;
const BUCKET = process.env.S3_BUCKET;
const PREFIX = (process.env.S3_DRAWINGS_PREFIX || "drawings").replace(/^\/+|\/+$/g, "");
// Document Repository files live under their own top-level prefix:
//   <bucket>/<S3_DOCUMENTS_PREFIX>/<projectTrackingId>/<category>/<name>-<ts>.<ext>
const DOCS_PREFIX = (process.env.S3_DOCUMENTS_PREFIX || "documents").replace(/^\/+|\/+$/g, "");

let _client = null;
function client() {
  if (!_client) {
    if (!REGION || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error("S3 not configured — set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY");
    }
    _client = new S3Client({
      region: REGION,
      credentials: {
        accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return _client;
}

function isConfigured() {
  return Boolean(
    BUCKET && REGION &&
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
  );
}

/**
 * URL-safe slug. Falls back to "x" so we never produce an empty path segment.
 */
function slugify(s, fallback = "x") {
  const out = String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return out || fallback;
}

/**
 * Compose the S3 key for a drawing. Pure function (no I/O).
 *
 * @param {Object} args
 * @param {string} args.projectTrackingId   e.g. "PRJ-2026-0003"
 * @param {string} args.zoneName            "Master Bedroom"
 * @param {string} args.designName          "AC Coordination"
 * @param {number} args.version             1-indexed
 * @param {string} args.originalFilename    used to extract the extension
 * @returns {string}
 */
function buildDrawingKey({ projectTrackingId, zoneName, designName, version, originalFilename }) {
  const ext = (() => {
    const dot = String(originalFilename || "").lastIndexOf(".");
    if (dot < 0) return "bin";
    const raw = originalFilename.slice(dot + 1).toLowerCase();
    return raw.replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
  })();
  const ts = Date.now();
  return [
    PREFIX,
    slugify(projectTrackingId, "project"),
    slugify(zoneName,          "general"),
    `${slugify(designName, "design")}-v${Number(version) || 1}-${ts}.${ext}`,
  ].join("/");
}

/**
 * Extract a normalised lowercase extension from a filename ("bin" fallback).
 */
function extOf(originalFilename) {
  const dot = String(originalFilename || "").lastIndexOf(".");
  if (dot < 0) return "bin";
  const raw = String(originalFilename).slice(dot + 1).toLowerCase();
  return raw.replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
}

/**
 * Compose the S3 key for a Document Repository file. Pure function (no I/O).
 *
 * @param {Object} args
 * @param {string} args.projectTrackingId   e.g. "PRJ-2026-0003"
 * @param {string} args.category            e.g. "client_details"
 * @param {string} args.name                display name ("Signed Agreement")
 * @param {string} args.originalFilename    used to extract the extension
 * @returns {string}
 */
function buildDocumentKey({ projectTrackingId, category, name, originalFilename }) {
  const ts = Date.now();
  return [
    DOCS_PREFIX,
    slugify(projectTrackingId, "project"),
    slugify(category, "documents"),
    `${slugify(name, "document")}-${ts}.${extOf(originalFilename)}`,
  ].join("/");
}

/**
 * Upload a Buffer to S3. Returns the canonical key + the public-style URL
 * (which still requires signing to access if the bucket is private).
 */
async function putObject({ key, body, contentType }) {
  if (!isConfigured()) throw new Error("S3 not configured");
  await client().send(new PutObjectCommand({
    Bucket: BUCKET,
    Key:    key,
    Body:   body,
    ContentType: contentType || "application/octet-stream",
    CacheControl: "private, max-age=0",
  }));
  return {
    key,
    bucket: BUCKET,
    url: `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`,
  };
}

/**
 * Generate a pre-signed GET URL. `disposition`:
 *   - "inline"     → browser previews (PDF / JPEG render in tab)
 *   - "attachment" → forces a download with a friendly filename
 */
async function getSignedDownloadUrl({ key, expiresIn = 3600, disposition = "inline", filename } = {}) {
  if (!isConfigured()) throw new Error("S3 not configured");
  const cmd = new GetObjectCommand({
    Bucket: BUCKET,
    Key:    key,
    ResponseContentDisposition: filename
      ? `${disposition}; filename="${filename.replace(/"/g, "")}"`
      : disposition,
  });
  return getSignedUrl(client(), cmd, { expiresIn });
}

/**
 * Permanent delete. Used when a draft drawing is hard-deleted before approval.
 * Not currently exposed by the UI — keep it here for future cleanup tasks.
 */
async function deleteObject({ key }) {
  if (!isConfigured()) throw new Error("S3 not configured");
  await client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/**
 * Recover { bucket, key } from a stored fileUrl that points at our S3 bucket.
 * Used by the signed-URL endpoint to backfill drawings whose `s3Key` is
 * missing on the document (e.g. uploaded before the schema field existed).
 *
 * Returns null when the URL is not an S3 URL we recognise — caller falls back
 * to the legacy path.
 */
function parseS3Url(fileUrl) {
  if (!fileUrl || typeof fileUrl !== "string") return null;
  let u;
  try { u = new URL(fileUrl); } catch { return null; }

  const host = u.hostname.toLowerCase();
  // Virtual-hosted style:  <bucket>.s3.<region>.amazonaws.com
  // or                     <bucket>.s3-<region>.amazonaws.com (older)
  // or                     <bucket>.s3.amazonaws.com         (us-east-1)
  const vh = host.match(/^(.+?)\.s3[.-]([a-z0-9-]+)\.amazonaws\.com$/)
          || host.match(/^(.+?)\.s3\.amazonaws\.com$/);
  if (vh) {
    const bucket = vh[1];
    const key    = u.pathname.replace(/^\/+/, "");
    if (!bucket || !key) return null;
    return { bucket, key };
  }

  // Path style: s3.<region>.amazonaws.com/<bucket>/<key>
  const ps = host.match(/^s3[.-]([a-z0-9-]+)\.amazonaws\.com$/)
          || (host === "s3.amazonaws.com" ? ["s3.amazonaws.com"] : null);
  if (ps) {
    const parts  = u.pathname.replace(/^\/+/, "").split("/");
    const bucket = parts.shift();
    const key    = parts.join("/");
    if (!bucket || !key) return null;
    return { bucket, key };
  }

  return null;
}

module.exports = {
  isConfigured,
  buildDrawingKey,
  buildDocumentKey,
  putObject,
  getSignedDownloadUrl,
  deleteObject,
  parseS3Url,
  // Pure helpers re-exported for tests / scripts.
  slugify,
};
