const mongoose = require("mongoose");
const puppeteer = require("puppeteer");
const ClientFormTemplate = require("../models/ClientFormTemplate.model");
const ClientFormLink     = require("../models/ClientFormLink.model");
const ClientFormResponse = require("../models/ClientFormResponse.model");
const ProjectDocument    = require("../models/ProjectDocument.model");
const Project            = require("../models/Project.model");
const s3Storage          = require("../services/s3Storage");
const mailQueue          = require("../../mail/service/mail.queue.service");
const whatsappQueue      = require("../../whatsapp/service/whatsapp.queue.service");

// ─── Templates ────────────────────────────────────────────────────────────────

const createTemplate = async (req, res) => {
  try {
    const { title, description, fields, projectId, sourceTemplateId } = req.body;
    if (!title?.trim()) return res.status(400).json({ message: "Title is required" });

    // A project-scoped copy is created via copy-on-write when a shared template
    // is edited inside a project. Only honour projectId when it's a valid id.
    const scopedProjectId =
      projectId && mongoose.Types.ObjectId.isValid(projectId) ? projectId : null;

    const template = await ClientFormTemplate.create({
      title: title.trim(),
      description: description?.trim() || "",
      fields: fields || [],
      createdBy: req.user?._id,
      projectId: scopedProjectId,
      sourceTemplateId:
        scopedProjectId && mongoose.Types.ObjectId.isValid(sourceTemplateId)
          ? sourceTemplateId
          : null,
    });
    res.status(201).json({ template });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getTemplates = async (req, res) => {
  try {
    // Default (global library): shared templates only (projectId null/absent).
    // With ?projectId=<id> (project Forms tab): shared templates PLUS that
    // project's own copies, so per-project customisations show alongside the
    // shared masters without leaking to other projects.
    const { projectId } = req.query;
    const filter = { isActive: true };
    if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
      filter.$or = [{ projectId: null }, { projectId }];
    } else {
      filter.projectId = null;
    }

    const templates = await ClientFormTemplate.find(filter)
      .sort({ createdAt: -1 })
      .populate("createdBy", "name")
      .lean();
    res.json({ templates });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getTemplate = async (req, res) => {
  try {
    const template = await ClientFormTemplate.findById(req.params.id).lean();
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.json({ template });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateTemplate = async (req, res) => {
  try {
    const { title, description, fields } = req.body;
    const update = {};
    if (title?.trim())        update.title       = title.trim();
    if (description != null)  update.description = description.trim();
    if (fields)               update.fields      = fields;

    const template = await ClientFormTemplate.findByIdAndUpdate(
      req.params.id, update, { new: true, runValidators: true }
    );
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.json({ template });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteTemplate = async (req, res) => {
  try {
    const template = await ClientFormTemplate.findByIdAndUpdate(
      req.params.id, { isActive: false }, { new: true }
    );
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.json({ message: "Template deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Form Links (per project) ─────────────────────────────────────────────────

const createFormLink = async (req, res) => {
  try {
    const { projectId, templateId, expiresAt } = req.body;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: "Valid projectId is required" });
    }
    if (!mongoose.Types.ObjectId.isValid(templateId)) {
      return res.status(400).json({ message: "Valid templateId is required" });
    }
    const [project, template] = await Promise.all([
      Project.findById(projectId).select("name").lean(),
      ClientFormTemplate.findById(templateId).lean(),
    ]);
    if (!project)  return res.status(404).json({ message: "Project not found" });
    if (!template) return res.status(404).json({ message: "Form template not found" });

    const link = await ClientFormLink.create({
      projectId,
      templateId,
      expiresAt: expiresAt || undefined,
      createdBy: req.user?._id,
    });
    await link.populate([
      { path: "templateId", select: "title description" },
      { path: "createdBy",  select: "name" },
    ]);
    res.status(201).json({ link });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getProjectFormLinks = async (req, res) => {
  try {
    const { projectId } = req.params;
    const links = await ClientFormLink.find({ projectId })
      .sort({ createdAt: -1 })
      .populate("templateId", "title description")
      .populate("createdBy", "name")
      .lean();

    // Attach response counts
    const linkIds = links.map((l) => l._id);
    const counts = await ClientFormResponse.aggregate([
      { $match: { formLinkId: { $in: linkIds } } },
      { $group: { _id: "$formLinkId", count: { $sum: 1 } } },
    ]);
    const countMap = {};
    counts.forEach((c) => { countMap[String(c._id)] = c.count; });

    const enriched = links.map((l) => ({
      ...l,
      responseCount: countMap[String(l._id)] || 0,
    }));
    res.json({ links: enriched });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteFormLink = async (req, res) => {
  try {
    const link = await ClientFormLink.findByIdAndDelete(req.params.id);
    if (!link) return res.status(404).json({ message: "Form link not found" });
    res.json({ message: "Form link deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Public form endpoints (no JWT required) ──────────────────────────────────

const getPublicForm = async (req, res) => {
  try {
    const link = await ClientFormLink.findOne({ token: req.params.token })
      .populate("templateId")
      .populate("projectId", "name")
      .lean();

    if (!link) return res.status(404).json({ message: "Form not found" });
    if (link.status === "completed") {
      return res.status(410).json({ message: "This form has already been submitted." });
    }
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      return res.status(410).json({ message: "This form link has expired." });
    }

    res.json({
      form: {
        title:       link.templateId.title,
        description: link.templateId.description,
        fields:      link.templateId.fields,
        projectName: link.projectId?.name,
        token:       link.token,
        status:      link.status,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const submitPublicForm = async (req, res) => {
  try {
    const link = await ClientFormLink.findOne({ token: req.params.token })
      .populate("templateId")
      .populate("projectId", "name trackingId")
      .lean();

    if (!link) return res.status(404).json({ message: "Form not found" });
    if (link.status === "completed") {
      return res.status(410).json({ message: "This form has already been submitted." });
    }
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      return res.status(410).json({ message: "This form link has expired." });
    }

    const { data } = req.body;  // fieldId → value

    // Validate required fields
    const template = link.templateId;
    for (const field of template.fields || []) {
      if (field.required && field.type !== "section") {
        const val = data?.[field.id];
        const isEmpty =
          val === undefined || val === null || val === "" ||
          (Array.isArray(val) && val.length === 0);
        if (isEmpty) {
          return res.status(400).json({ message: `"${field.label}" is required.` });
        }
      }
    }

    // Save response first
    const response = await ClientFormResponse.create({
      formLinkId:  link._id,
      projectId:   link.projectId._id,
      templateId:  link.templateId._id,
      data:        new Map(Object.entries(data || {})),
      submittedAt: new Date(),
    });

    // Mark link as completed
    await ClientFormLink.findByIdAndUpdate(link._id, {
      status: "completed",
      submittedAt: new Date(),
    });

    // Generate PDF and store asynchronously (don't block the response)
    generateAndStoreResponsePdf({
      response,
      link,
      template,
      data: data || {},
    }).catch((err) => {
      console.error("[ClientForm] PDF generation failed:", err.message);
    });

    res.json({ message: "Form submitted successfully. Thank you!" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── PDF generation helper ────────────────────────────────────────────────────

async function generateAndStoreResponsePdf({ response, link, template, data }) {
  if (!s3Storage.isConfigured()) return;

  const fields = template.fields || [];
  const html = buildFormPdfHtml({ template, data, fields, link, response });

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", bottom: "20mm", left: "20mm", right: "20mm" },
    });

    const project = await Project.findById(link.projectId._id || link.projectId)
      .select("trackingId name").lean();
    if (!project) return;

    const docName = `Client Form — ${template.title}`;
    const key = s3Storage.buildDocumentKey({
      projectTrackingId: project.trackingId,
      category: "client_details",
      name: docName,
      originalFilename: "client-form.pdf",
    });

    await s3Storage.putObject({ key, body: pdfBuffer, contentType: "application/pdf" });

    const doc = await ProjectDocument.create({
      projectId: project._id,
      name: docName,
      description: `Submitted on ${new Date(response.submittedAt).toLocaleDateString("en-IN")}`,
      category: "client_details",
      status: "verified",
      fileName: `${key.split("/").pop()}`,
      fileType: "application/pdf",
      fileSize: pdfBuffer.length,
      fileUrl: `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
      s3Bucket: process.env.S3_BUCKET,
      s3Key: key,
      source: "manual",
      uploadedBy: link.createdBy,
    });

    await ClientFormResponse.findByIdAndUpdate(response._id, { documentId: doc._id });
  } finally {
    if (browser) await browser.close();
  }
}

function buildFormPdfHtml({ template, data, fields, link, response }) {
  const renderValue = (field) => {
    const val = data[field.id];
    if (val === undefined || val === null || val === "") return "<em style='color:#aaa'>—</em>";
    if (Array.isArray(val)) return val.join(", ");
    return String(val).replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
  };

  const rows = fields
    .filter((f) => f.type !== "section")
    .map((f) => `
      <tr>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb;width:35%;vertical-align:top;color:#374151;">
          ${f.label}${f.required ? ' <span style="color:#ef4444">*</span>' : ""}
        </td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#111827;">
          ${renderValue(f)}
        </td>
      </tr>
    `)
    .join("");

  const submittedAt = new Date(response.submittedAt).toLocaleString("en-IN", {
    dateStyle: "full", timeStyle: "short", timeZone: "Asia/Kolkata",
  });
  const projectName = link.projectId?.name || "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: 'Segoe UI', sans-serif; margin: 0; color: #111827; }
  h1   { font-size: 22px; margin: 0 0 4px; color: #111827; }
  p    { margin: 0; font-size: 13px; color: #6b7280; }
  table { width:100%; border-collapse: collapse; margin-top: 24px; }
  .header { border-bottom: 2px solid #b45309; padding-bottom: 16px; margin-bottom: 8px; }
  .badge  { display:inline-block; background:#b45309; color:#fff; font-size:10px;
            font-weight:700; padding:2px 8px; border-radius:4px; text-transform:uppercase;
            letter-spacing:.05em; margin-bottom:8px; }
  .meta   { font-size:11px; color:#9ca3af; margin-top: 16px; }
</style>
</head>
<body>
  <div class="header">
    <div class="badge">JJ Studio</div>
    <h1>${template.title}</h1>
    ${template.description ? `<p>${template.description}</p>` : ""}
    ${projectName ? `<p style="margin-top:4px">Project: <strong>${projectName}</strong></p>` : ""}
  </div>

  <table>
    <tbody>${rows}</tbody>
  </table>

  <div class="meta">
    Submitted on ${submittedAt}
  </div>
</body>
</html>`;
}

// ─── Send form link ───────────────────────────────────────────────────────────

const sendFormLink = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, phone, message: customMessage } = req.body;

    const link = await ClientFormLink.findById(id)
      .populate("templateId", "title")
      .populate("projectId", "name")
      .lean();
    if (!link) return res.status(404).json({ message: "Form link not found" });

    const appUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const formUrl = `${appUrl}/forms/${link.token}`;
    const formTitle = link.templateId?.title || "Client Form";
    const projectName = link.projectId?.name || "";

    const defaultMessage =
      `Hi, JJ Studio has shared a form with you: "${formTitle}"` +
      (projectName ? ` for your project "${projectName}"` : "") +
      `.\n\nPlease fill it at: ${formUrl}`;

    const sendMessage = customMessage
      ? `${customMessage}\n\nForm link: ${formUrl}`
      : defaultMessage;

    const sent = [];
    const errors = [];

    if (email) {
      try {
        await mailQueue.enqueue({
          to: email,
          subject: `${formTitle} — JJ Studio`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
              <h2 style="color:#b45309">${formTitle}</h2>
              ${projectName ? `<p>Project: <strong>${projectName}</strong></p>` : ""}
              <p>${(customMessage || "").replace(/\n/g, "<br>") ||
                "Please fill in the form linked below."}</p>
              <p style="margin-top:24px">
                <a href="${formUrl}"
                   style="background:#b45309;color:#fff;padding:10px 20px;
                          border-radius:6px;text-decoration:none;font-weight:600">
                  Open Form
                </a>
              </p>
              <p style="margin-top:12px;font-size:12px;color:#6b7280">
                Or copy this link: <a href="${formUrl}">${formUrl}</a>
              </p>
            </div>
          `,
          relatedTo: { module: "pms", recordId: link.projectId?._id },
          createdBy: req.user?._id,
        });
        sent.push("email");
      } catch (e) {
        errors.push(`Email: ${e.message}`);
      }
    }

    if (phone) {
      try {
        await whatsappQueue.enqueue({
          to: phone,
          message: sendMessage,
          relatedTo: { module: "pms", recordId: link.projectId?._id },
          createdBy: req.user?._id,
        });
        sent.push("whatsapp");
      } catch (e) {
        errors.push(`WhatsApp: ${e.message}`);
      }
    }

    if (sent.length === 0 && errors.length > 0) {
      return res.status(500).json({ message: errors.join("; ") });
    }

    res.json({
      message: `Form link sent via ${sent.join(" and ")}`,
      formUrl,
      errors: errors.length ? errors : undefined,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Get responses for a project ──────────────────────────────────────────────

const getProjectFormResponses = async (req, res) => {
  try {
    const { projectId } = req.params;
    const responses = await ClientFormResponse.find({ projectId })
      .sort({ submittedAt: -1 })
      .populate("templateId", "title fields")
      .populate("formLinkId", "token status")
      .populate("documentId", "name s3Key")
      .lean();
    res.json({ responses });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createTemplate,
  getTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  createFormLink,
  getProjectFormLinks,
  deleteFormLink,
  getPublicForm,
  submitPublicForm,
  sendFormLink,
  getProjectFormResponses,
};
