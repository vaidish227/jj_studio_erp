const mongoose = require("mongoose");
const Delegation = require("../models/Delegation.model");
const DelegationComment = require("../models/DelegationComment.model");
const DelegationActivity = require("../models/DelegationActivity.model");
const Department = require("../../department/models/Department.model");
const User = require("../../auth/models/user.model");
const { hasPermission } = require("../../../middleware/auth.middleware");
const s3 = require("../../pms/services/s3Storage");
const {
  createDelegationSchema,
  updateDelegationSchema,
  assignSchema,
  reassignSchema,
  statusChangeSchema,
  checklistSchema,
  commentSchema,
} = require("../validator/delegation.validator");
const { logDelegationActivity } = require("../services/delegationActivity.service");
const { computeProgress } = require("../services/delegationProgress.service");
const {
  canTransition,
  allowedFrom,
  buildStatusPatch,
  actionForStatus,
} = require("../services/delegationWorkflow.service");
const { notify, findAssignerIds } = require("../services/delegationNotify.service");

const POPULATE = [
  { path: "departmentId", select: "name slug color icon" },
  { path: "assignedTo", select: "name email role" },
  { path: "createdBy", select: "name email role" },
  { path: "assignedBy", select: "name email role" },
  { path: "projectId", select: "name trackingId" },
  { path: "clientId", select: "name trackingId" },
];

// ─── Scoping ──────────────────────────────────────────────────────────────────
// delegation.viewAll (and admin '*') → every delegation. Otherwise a user only
// sees delegations they created or are assigned to. Enforced server-side on
// every read so it also guards GET /:id (out-of-scope id → 404).
const scopeFilter = (req) => {
  if (hasPermission(req.permissions, "delegation.viewAll")) return {};
  const me = req.user._id;
  return { $or: [{ assignedTo: me }, { createdBy: me }] };
};

// Load an in-scope delegation document (not lean) or null.
const findInScope = async (req, id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return Delegation.findOne({ _id: id, ...scopeFilter(req) });
};

const validationError = (res, error) =>
  res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });

// Escape user-supplied text before using it in a $regex so special characters
// are matched literally — prevents ReDoS / unintended pattern matching on the
// title search (R5).
const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Notify the assignee + creator (minus the actor) of an event.
const stakeholderIds = (delegation) =>
  [delegation.assignedTo, delegation.createdBy].filter(Boolean).map(String);

// ─── GET /api/delegations ─────────────────────────────────────────────────────
const listDelegations = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, departmentId, assignedTo, createdBy, priority, overdue, q } = req.query;
    const filter = { ...scopeFilter(req) };

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (departmentId && mongoose.Types.ObjectId.isValid(departmentId)) filter.departmentId = departmentId;
    if (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo)) filter.assignedTo = assignedTo;
    if (createdBy && mongoose.Types.ObjectId.isValid(createdBy)) filter.createdBy = createdBy;
    if (overdue === "true") {
      filter.dueDate = { $lt: new Date() };
      filter.status = { $nin: ["completed", "cancelled"] };
    }
    if (q && q.trim()) filter.title = { $regex: escapeRegex(q.trim()), $options: "i" };

    const pg = Math.max(1, Number(page));
    const lim = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pg - 1) * lim;

    const [total, delegations] = await Promise.all([
      Delegation.countDocuments(filter),
      Delegation.find(filter).populate(POPULATE).sort({ createdAt: -1 }).skip(skip).limit(lim),
    ]);

    res.status(200).json({ message: "Delegations fetched", total, page: pg, limit: lim, delegations });
  } catch (error) {
    console.error("[listDelegations]", error);
    res.status(500).json({ message: error.message });
  }
};

// ─── GET /api/delegations/:id ─────────────────────────────────────────────────
const getDelegation = async (req, res) => {
  try {
    const delegation = await findInScope(req, req.params.id);
    if (!delegation) return res.status(404).json({ message: "Delegation not found" });
    await delegation.populate(POPULATE);
    res.status(200).json({ message: "Delegation fetched", delegation });
  } catch (error) {
    console.error("[getDelegation]", error);
    res.status(500).json({ message: error.message });
  }
};

// Validate optional references; returns an error string or null.
const validateRefs = async ({ departmentId, assignedTo }) => {
  if (departmentId) {
    const dep = await Department.findById(departmentId).lean();
    if (!dep) return "Department not found";
    if (dep.isActive === false) return "Department is inactive";
  }
  if (assignedTo) {
    const u = await User.findById(assignedTo).select("isActive").lean();
    if (!u) return "Assignee not found";
    if (u.isActive === false) return "Cannot assign to an inactive user";
  }
  return null;
};

// ─── POST /api/delegations ────────────────────────────────────────────────────
const createDelegation = async (req, res) => {
  try {
    const { error, value } = createDelegationSchema.validate(req.body, { abortEarly: false });
    if (error) return validationError(res, error);

    const refErr = await validateRefs(value);
    if (refErr) return res.status(400).json({ message: refErr });

    const doc = {
      title: value.title,
      description: value.description || "",
      departmentId: value.departmentId || undefined,
      projectId: value.projectId || undefined,
      clientId: value.clientId || undefined,
      priority: value.priority || "medium",
      dueDate: value.dueDate || undefined,
      createdBy: req.user._id,
      checklist: (value.checklist || []).map((c) => ({ item: c.item, isCompleted: false })),
    };
    if (value.assignedTo) {
      doc.assignedTo = value.assignedTo;
      doc.assignedBy = req.user._id;
      doc.status = "assigned";
    }
    doc.progressPercent = computeProgress(doc.checklist);

    const created = await Delegation.create(doc);

    logDelegationActivity({
      delegationId: created._id,
      actorId: req.user._id,
      action: "created",
      description: `Delegation created: ${created.title}`,
      metadata: { trackingId: created.trackingId, priority: created.priority },
    });

    if (created.assignedTo) {
      notify({
        type: "delegation.assigned",
        title: `New delegation: ${created.title}`,
        message: `You have been assigned "${created.title}" (${created.trackingId}).`,
        delegation: created,
        actor: req.user,
        recipients: [created.assignedTo],
        email: {
          subject: `New delegation assigned: ${created.title}`,
          html: `<p>You have been assigned a new delegation.</p><p><b>${created.title}</b> (${created.trackingId})</p>`,
        },
      });
    } else {
      // No assignee yet — alert the users who can assign so the delegation
      // doesn't sit unassigned with nobody notified (B1). In-app only: emailing
      // the whole assigner pool on every unassigned create would be noise. The
      // dispatcher also copies admin/md by default; this additionally reaches
      // managers (and any custom-permission assigners). The creator is filtered
      // out automatically as the actor. Fully fire-and-forget — like the
      // assigned path, it must not add latency to or fail the create request.
      findAssignerIds()
        .then((assignerIds) =>
          notify({
            type: "delegation.created",
            title: `Unassigned delegation: ${created.title}`,
            message: `"${created.title}" (${created.trackingId}) was created with no assignee and needs an owner.`,
            delegation: created,
            actor: req.user,
            recipients: assignerIds,
          })
        )
        .catch((err) => console.error("[createDelegation:notifyAssigners]", err.message));
    }

    await created.populate(POPULATE);
    res.status(201).json({ message: "Delegation created", delegation: created });
  } catch (error) {
    console.error("[createDelegation]", error);
    res.status(500).json({ message: error.message });
  }
};

// ─── PATCH /api/delegations/:id ───────────────────────────────────────────────
const updateDelegation = async (req, res) => {
  try {
    const { error, value } = updateDelegationSchema.validate(req.body, { abortEarly: false });
    if (error) return validationError(res, error);

    const refErr = await validateRefs(value);
    if (refErr) return res.status(400).json({ message: refErr });

    const delegation = await findInScope(req, req.params.id);
    if (!delegation) return res.status(404).json({ message: "Delegation not found" });

    Object.assign(delegation, value);
    await delegation.save();

    logDelegationActivity({
      delegationId: delegation._id,
      actorId: req.user._id,
      action: "status_changed", // generic edit; status-specific changes use /status
      description: `Delegation updated: ${delegation.title}`,
      metadata: { fields: Object.keys(value) },
    });

    await delegation.populate(POPULATE);
    res.status(200).json({ message: "Delegation updated", delegation });
  } catch (error) {
    console.error("[updateDelegation]", error);
    res.status(500).json({ message: error.message });
  }
};

// ─── DELETE /api/delegations/:id (soft-cancel) ────────────────────────────────
const deleteDelegation = async (req, res) => {
  try {
    const delegation = await findInScope(req, req.params.id);
    if (!delegation) return res.status(404).json({ message: "Delegation not found" });

    if (delegation.status === "cancelled") {
      return res.status(400).json({ message: "Delegation is already cancelled" });
    }
    if (!canTransition(delegation.status, "cancelled")) {
      return res.status(400).json({
        message: `Cannot cancel a delegation in status "${delegation.status}".`,
      });
    }

    delegation.status = "cancelled";
    await delegation.save();

    logDelegationActivity({
      delegationId: delegation._id,
      actorId: req.user._id,
      action: "cancelled",
      description: `Delegation cancelled: ${delegation.title}`,
    });

    notify({
      type: "delegation.cancelled",
      title: `Delegation cancelled: ${delegation.title}`,
      delegation,
      actor: req.user,
      recipients: stakeholderIds(delegation),
    });

    res.status(200).json({ message: "Delegation cancelled", delegation });
  } catch (error) {
    console.error("[deleteDelegation]", error);
    res.status(500).json({ message: error.message });
  }
};

// ─── PATCH /api/delegations/:id/assign ────────────────────────────────────────
const assignDelegation = async (req, res) => {
  try {
    const { error, value } = assignSchema.validate(req.body, { abortEarly: false });
    if (error) return validationError(res, error);

    const refErr = await validateRefs({ assignedTo: value.assignedTo });
    if (refErr) return res.status(400).json({ message: refErr });

    const delegation = await findInScope(req, req.params.id);
    if (!delegation) return res.status(404).json({ message: "Delegation not found" });

    delegation.assignedTo = value.assignedTo;
    delegation.assignedBy = req.user._id;
    if (delegation.status === "created") delegation.status = "assigned";
    await delegation.save();

    logDelegationActivity({
      delegationId: delegation._id,
      actorId: req.user._id,
      action: "assigned",
      description: `Assigned to user ${value.assignedTo}`,
      metadata: { assignedTo: value.assignedTo, note: value.note },
    });

    notify({
      type: "delegation.assigned",
      title: `Delegation assigned: ${delegation.title}`,
      message: `You have been assigned "${delegation.title}" (${delegation.trackingId}).`,
      delegation,
      actor: req.user,
      recipients: [value.assignedTo],
      email: {
        subject: `Delegation assigned: ${delegation.title}`,
        html: `<p>You have been assigned <b>${delegation.title}</b> (${delegation.trackingId}).</p>`,
      },
    });

    await delegation.populate(POPULATE);
    res.status(200).json({ message: "Delegation assigned", delegation });
  } catch (error) {
    console.error("[assignDelegation]", error);
    res.status(500).json({ message: error.message });
  }
};

// ─── PATCH /api/delegations/:id/reassign ──────────────────────────────────────
const reassignDelegation = async (req, res) => {
  try {
    const { error, value } = reassignSchema.validate(req.body, { abortEarly: false });
    if (error) return validationError(res, error);

    const refErr = await validateRefs({ assignedTo: value.assignedTo });
    if (refErr) return res.status(400).json({ message: refErr });

    const delegation = await findInScope(req, req.params.id);
    if (!delegation) return res.status(404).json({ message: "Delegation not found" });

    const previous = delegation.assignedTo ? String(delegation.assignedTo) : null;
    delegation.assignedTo = value.assignedTo;
    delegation.assignedBy = req.user._id;
    if (delegation.status === "created") delegation.status = "assigned";
    await delegation.save();

    logDelegationActivity({
      delegationId: delegation._id,
      actorId: req.user._id,
      action: "reassigned",
      description: `Reassigned to user ${value.assignedTo}`,
      metadata: { from: previous, to: value.assignedTo, reason: value.reason },
    });

    notify({
      type: "delegation.reassigned",
      title: `Delegation reassigned: ${delegation.title}`,
      message: `"${delegation.title}" (${delegation.trackingId}) was reassigned to you.`,
      delegation,
      actor: req.user,
      recipients: [value.assignedTo, ...(previous ? [previous] : [])],
      email: {
        to: undefined, // resolved from recipients
        subject: `Delegation reassigned: ${delegation.title}`,
        html: `<p><b>${delegation.title}</b> (${delegation.trackingId}) has been reassigned.</p><p>Reason: ${value.reason}</p>`,
      },
    });

    await delegation.populate(POPULATE);
    res.status(200).json({ message: "Delegation reassigned", delegation });
  } catch (error) {
    console.error("[reassignDelegation]", error);
    res.status(500).json({ message: error.message });
  }
};

// ─── PATCH /api/delegations/:id/status ────────────────────────────────────────
const changeStatus = async (req, res) => {
  try {
    const { error, value } = statusChangeSchema.validate(req.body, { abortEarly: false });
    if (error) return validationError(res, error);

    const delegation = await findInScope(req, req.params.id);
    if (!delegation) return res.status(404).json({ message: "Delegation not found" });

    const from = delegation.status;
    const to = value.status;

    if (from === to) {
      return res.status(400).json({ message: `Delegation is already "${to}"` });
    }
    if (!canTransition(from, to)) {
      return res.status(400).json({
        message: `Illegal transition ${from} → ${to}.`,
        allowed: allowedFrom(from),
      });
    }

    Object.assign(delegation, buildStatusPatch(delegation, to));
    await delegation.save();

    logDelegationActivity({
      delegationId: delegation._id,
      actorId: req.user._id,
      action: actionForStatus(to),
      description: `Status changed ${from} → ${to}`,
      metadata: { from, to, note: value.note },
    });

    notify({
      type: "delegation.status_changed",
      title: `Delegation ${to}: ${delegation.title}`,
      message: `"${delegation.title}" (${delegation.trackingId}) moved from ${from} to ${to}.`,
      delegation,
      actor: req.user,
      recipients: stakeholderIds(delegation),
    });

    await delegation.populate(POPULATE);
    res.status(200).json({ message: "Status updated", delegation });
  } catch (error) {
    console.error("[changeStatus]", error);
    res.status(500).json({ message: error.message });
  }
};

// ─── PATCH /api/delegations/:id/checklist ─────────────────────────────────────
const updateChecklist = async (req, res) => {
  try {
    const { error, value } = checklistSchema.validate(req.body, { abortEarly: false });
    if (error) return validationError(res, error);

    const delegation = await findInScope(req, req.params.id);
    if (!delegation) return res.status(404).json({ message: "Delegation not found" });

    if (value.op === "add") {
      delegation.checklist.push({ item: value.item, isCompleted: false });
    } else {
      const item = delegation.checklist.id(value.itemId);
      if (!item) return res.status(404).json({ message: "Checklist item not found" });
      if (value.op === "toggle") {
        item.isCompleted = !item.isCompleted;
        item.completedBy = item.isCompleted ? req.user._id : undefined;
        item.completedAt = item.isCompleted ? new Date() : undefined;
      } else if (value.op === "remove") {
        item.deleteOne();
      }
    }

    delegation.progressPercent = computeProgress(delegation.checklist);
    await delegation.save();

    logDelegationActivity({
      delegationId: delegation._id,
      actorId: req.user._id,
      action: "checklist_updated",
      description: `Checklist ${value.op}`,
      metadata: { op: value.op, progressPercent: delegation.progressPercent },
    });

    res.status(200).json({ message: "Checklist updated", delegation });
  } catch (error) {
    console.error("[updateChecklist]", error);
    res.status(500).json({ message: error.message });
  }
};

// ─── GET /api/delegations/:id/comments ────────────────────────────────────────
const listComments = async (req, res) => {
  try {
    const delegation = await findInScope(req, req.params.id);
    if (!delegation) return res.status(404).json({ message: "Delegation not found" });

    const comments = await DelegationComment.find({ delegationId: delegation._id })
      .populate({ path: "authorId", select: "name email role" })
      .sort({ createdAt: 1 });

    res.status(200).json({ count: comments.length, comments });
  } catch (error) {
    console.error("[listComments]", error);
    res.status(500).json({ message: error.message });
  }
};

// ─── POST /api/delegations/:id/comments ───────────────────────────────────────
const addComment = async (req, res) => {
  try {
    const { error, value } = commentSchema.validate(req.body, { abortEarly: false });
    if (error) return validationError(res, error);

    const delegation = await findInScope(req, req.params.id);
    if (!delegation) return res.status(404).json({ message: "Delegation not found" });

    const comment = await DelegationComment.create({
      delegationId: delegation._id,
      authorId: req.user._id,
      body: value.body,
    });

    logDelegationActivity({
      delegationId: delegation._id,
      actorId: req.user._id,
      action: "commented",
      description: "Added a comment",
    });

    notify({
      type: "delegation.commented",
      title: `New comment on: ${delegation.title}`,
      message: value.body.slice(0, 140),
      delegation,
      actor: req.user,
      recipients: stakeholderIds(delegation),
    });

    await comment.populate({ path: "authorId", select: "name email role" });
    res.status(201).json({ message: "Comment added", comment });
  } catch (error) {
    console.error("[addComment]", error);
    res.status(500).json({ message: error.message });
  }
};

// ─── POST /api/delegations/:id/attachments ────────────────────────────────────
const KIND_BY_MIME = (mime) => {
  if (/^image\//.test(mime)) return "image";
  if (mime === "application/pdf") return "pdf";
  return "document";
};

const addAttachment = async (req, res) => {
  try {
    if (req.fileFilterError) return res.status(400).json({ message: req.fileFilterError });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    if (!s3.isConfigured()) {
      return res.status(503).json({ message: "File storage is not configured (S3)" });
    }

    const delegation = await findInScope(req, req.params.id);
    if (!delegation) return res.status(404).json({ message: "Delegation not found" });

    const original = req.file.originalname || "file";
    const ext = (() => {
      const dot = original.lastIndexOf(".");
      const raw = dot >= 0 ? original.slice(dot + 1).toLowerCase() : "bin";
      return raw.replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
    })();
    const key = [
      "delegations",
      s3.slugify(delegation.trackingId, "delegation"),
      `${s3.slugify(original.replace(/\.[^.]+$/, ""), "file")}-${Date.now()}.${ext}`,
    ].join("/");

    const { url, bucket } = await s3.putObject({
      key,
      body: req.file.buffer,
      contentType: req.file.mimetype,
    });

    delegation.attachments.push({
      name: original,
      fileName: original,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      fileUrl: url,
      s3Bucket: bucket,
      s3Key: key,
      kind: KIND_BY_MIME(req.file.mimetype),
      uploadedBy: req.user._id,
    });
    await delegation.save();

    logDelegationActivity({
      delegationId: delegation._id,
      actorId: req.user._id,
      action: "attachment_added",
      description: `Attached ${original}`,
      metadata: { fileName: original },
    });

    res.status(201).json({ message: "Attachment added", delegation });
  } catch (error) {
    console.error("[addAttachment]", error);
    res.status(500).json({ message: error.message });
  }
};

// ─── DELETE /api/delegations/:id/attachments/:attId ───────────────────────────
const removeAttachment = async (req, res) => {
  try {
    const delegation = await findInScope(req, req.params.id);
    if (!delegation) return res.status(404).json({ message: "Delegation not found" });

    const att = delegation.attachments.id(req.params.attId);
    if (!att) return res.status(404).json({ message: "Attachment not found" });

    // Best-effort S3 cleanup — never block the delete on it.
    if (att.s3Key && s3.isConfigured()) {
      try {
        await s3.deleteObject({ key: att.s3Key });
      } catch (e) {
        console.error("[removeAttachment:s3]", e.message);
      }
    }
    att.deleteOne();
    await delegation.save();

    logDelegationActivity({
      delegationId: delegation._id,
      actorId: req.user._id,
      action: "attachment_removed",
      description: `Removed attachment ${att.fileName || att.name}`,
      metadata: { removed: att.fileName },
    });

    res.status(200).json({ message: "Attachment removed", delegation });
  } catch (error) {
    console.error("[removeAttachment]", error);
    res.status(500).json({ message: error.message });
  }
};

// ─── GET /api/delegations/:id/attachments/:attId/url (signed download) ─────────
const getAttachmentUrl = async (req, res) => {
  try {
    const delegation = await findInScope(req, req.params.id);
    if (!delegation) return res.status(404).json({ message: "Delegation not found" });
    const att = delegation.attachments.id(req.params.attId);
    if (!att) return res.status(404).json({ message: "Attachment not found" });
    if (!att.s3Key || !s3.isConfigured()) {
      return res.status(200).json({ url: att.fileUrl }); // fallback to stored url
    }
    const url = await s3.getSignedDownloadUrl({ key: att.s3Key, filename: att.fileName });
    res.status(200).json({ url });
  } catch (error) {
    console.error("[getAttachmentUrl]", error);
    res.status(500).json({ message: error.message });
  }
};

// ─── GET /api/delegations/:id/activity ────────────────────────────────────────
const getActivity = async (req, res) => {
  try {
    const delegation = await findInScope(req, req.params.id);
    if (!delegation) return res.status(404).json({ message: "Delegation not found" });

    const activity = await DelegationActivity.find({ delegationId: delegation._id })
      .populate({ path: "actorId", select: "name role" })
      .sort({ createdAt: -1 })
      .limit(200);

    res.status(200).json({ count: activity.length, activity });
  } catch (error) {
    console.error("[getActivity]", error);
    res.status(500).json({ message: error.message });
  }
};

// ─── GET /api/delegations/dashboard ───────────────────────────────────────────
const getDashboard = async (req, res) => {
  try {
    const base = scopeFilter(req);
    const now = new Date();
    const openStatuses = ["created", "assigned", "in_progress", "review", "reopened"];

    const [pending, inProgress, inReview, completed, overdue, byDeptRaw] = await Promise.all([
      Delegation.countDocuments({ ...base, status: { $in: ["created", "assigned"] } }),
      Delegation.countDocuments({ ...base, status: "in_progress" }),
      Delegation.countDocuments({ ...base, status: "review" }),
      Delegation.countDocuments({ ...base, status: "completed" }),
      Delegation.countDocuments({ ...base, dueDate: { $lt: now }, status: { $nin: ["completed", "cancelled"] } }),
      Delegation.aggregate([
        { $match: { ...base, status: { $in: openStatuses } } },
        { $group: { _id: "$departmentId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    // Attach department names to workload buckets.
    const deptIds = byDeptRaw.map((d) => d._id).filter(Boolean);
    const depts = await Department.find({ _id: { $in: deptIds } }).select("name color").lean();
    const deptMap = Object.fromEntries(depts.map((d) => [String(d._id), d]));
    const workload = byDeptRaw.map((d) => ({
      departmentId: d._id,
      name: d._id ? deptMap[String(d._id)]?.name || "Unknown" : "Unassigned",
      color: d._id ? deptMap[String(d._id)]?.color : undefined,
      count: d.count,
    }));

    // Recent activity across in-scope delegations.
    let activityFilter = {};
    if (!hasPermission(req.permissions, "delegation.viewAll")) {
      const ids = await Delegation.find(base).select("_id").lean();
      activityFilter = { delegationId: { $in: ids.map((d) => d._id) } };
    }
    const recentActivity = await DelegationActivity.find(activityFilter)
      .populate({ path: "actorId", select: "name role" })
      .populate({ path: "delegationId", select: "title trackingId" })
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({
      message: "Dashboard data",
      kpis: { pending, inProgress, inReview, completed, overdue },
      workload,
      recentActivity,
    });
  } catch (error) {
    console.error("[getDashboard]", error);
    res.status(500).json({ message: error.message });
  }
};

// ─── GET /api/delegations/assignees ───────────────────────────────────────────
// Active internal users (excludes external vendor/client) for the assign picker.
const listAssignees = async (req, res) => {
  try {
    const users = await User.find({ isActive: true, role: { $nin: ["vendor", "client"] } })
      .select("name email role")
      .sort({ name: 1 })
      .lean();
    res.status(200).json({ count: users.length, users });
  } catch (error) {
    console.error("[listAssignees]", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  listAssignees,
  listDelegations,
  getDelegation,
  createDelegation,
  updateDelegation,
  deleteDelegation,
  assignDelegation,
  reassignDelegation,
  changeStatus,
  updateChecklist,
  listComments,
  addComment,
  addAttachment,
  removeAttachment,
  getAttachmentUrl,
  getActivity,
  getDashboard,
};
