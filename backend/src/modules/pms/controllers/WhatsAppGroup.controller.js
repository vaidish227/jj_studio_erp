const WhatsAppProjectGroup = require("../models/WhatsAppProjectGroup.model");
const Project              = require("../models/Project.model");
const {
  createGroupSchema,
  updateGroupSchema,
  sendUpdateSchema,
  addMemberSchema,
  removeMemberSchema,
} = require("../validator/WhatsAppGroup.validator");
const { logActivity }  = require("../../../shared/activityLogger");
const { sendImmediate, getSettings, getProviderConfig } = require("../../whatsapp/service/whatsapp.service");

// Kickstart field that maps to each group type
const KICKSTART_FLAG = {
  main:        "mainGroupCreated",
  drawing:     "drawingGroupCreated",
  supervision: "supervisionGroupCreated",
  payment:     "paymentGroupCreated",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Attempt a Maytapi group operation. Returns { success, error } — never throws.
 * Used for sync operations that should not block ERP operations.
 */
const tryProviderOp = async (fn) => {
  try {
    const result = await fn();
    return { success: true, result };
  } catch (err) {
    console.warn("[WhatsAppGroup] provider op failed:", err.message);
    return { success: false, error: err.message };
  }
};

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * @route POST /api/pms/whatsapp-group/create
 */
const createGroup = async (req, res) => {
  try {
    const { error, value } = createGroupSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });

    const group = await WhatsAppProjectGroup.create({
      ...value,
      createdBy: req.user._id,
    });

    // Auto-mark kickstart flag for standard group types
    const flag = KICKSTART_FLAG[value.groupType];
    if (flag) {
      await Project.findByIdAndUpdate(value.projectId, {
        $set: { [`kickstartData.${flag}`]: true },
      });
    }

    logActivity({
      projectId:   value.projectId,
      actorId:     req.user._id,
      entityType:  "whatsapp_group",
      entityId:    group._id,
      action:      "created",
      description: `WhatsApp group "${group.groupName}" (${group.groupType}) created`,
    });

    res.status(201).json({ message: "WhatsApp group created", data: group });
  } catch (err) {
    console.error("[createGroup]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route GET /api/pms/whatsapp-group/project/:projectId
 */
const getGroupsByProject = async (req, res) => {
  try {
    const groups = await WhatsAppProjectGroup.find({ projectId: req.params.projectId })
      .populate("createdBy", "name email")
      .populate("members.userId", "name email role phone")
      .populate("members.addedBy", "name")
      .sort({ groupType: 1, createdAt: -1 })
      .lean();

    res.status(200).json({ message: "Groups fetched", data: { count: groups.length, groups } });
  } catch (err) {
    console.error("[getGroupsByProject]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route GET /api/pms/whatsapp-group/all
 * Cross-project group listing with filters. Paginated.
 */
const getAllGroups = async (req, res) => {
  try {
    const { projectId, groupType, syncStatus, page = 1, limit = 20 } = req.query;
    const query = {};
    if (projectId)  query.projectId  = projectId;
    if (groupType)  query.groupType  = groupType;
    if (syncStatus) query.syncStatus = syncStatus;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [groups, total] = await Promise.all([
      WhatsAppProjectGroup.find(query)
        .populate("projectId", "name trackingId status")
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      WhatsAppProjectGroup.countDocuments(query),
    ]);

    res.status(200).json({
      message: "All groups fetched",
      data: { groups, total, page: Number(page), limit: Number(limit) },
    });
  } catch (err) {
    console.error("[getAllGroups]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route GET /api/pms/whatsapp-group/:id
 */
const getGroupById = async (req, res) => {
  try {
    const group = await WhatsAppProjectGroup.findById(req.params.id)
      .populate("projectId", "name trackingId status")
      .populate("createdBy", "name email")
      .populate("members.userId", "name email role phone")
      .populate("members.addedBy", "name")
      .lean();

    if (!group) return res.status(404).json({ message: "Group not found" });

    res.status(200).json({ message: "Group fetched", data: group });
  } catch (err) {
    console.error("[getGroupById]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route PUT /api/pms/whatsapp-group/update/:id
 */
const updateGroup = async (req, res) => {
  try {
    const { error, value } = updateGroupSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });

    const updateData = { ...value };

    // When user manually sets a providerGroupId, reset sync state so "Re-sync Members"
    // becomes available and any previous "failed" status is cleared.
    if (value.providerGroupId) {
      updateData.syncStatus = "unsynced";
      updateData.syncErrors = [];
    }

    const group = await WhatsAppProjectGroup.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    );

    if (!group) return res.status(404).json({ message: "Group not found" });

    res.status(200).json({ message: "Group updated", data: group });
  } catch (err) {
    console.error("[updateGroup]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route DELETE /api/pms/whatsapp-group/delete/:id
 */
const deleteGroup = async (req, res) => {
  try {
    const group = await WhatsAppProjectGroup.findByIdAndDelete(req.params.id);
    if (!group) return res.status(404).json({ message: "Group not found" });

    res.status(200).json({ message: "Group deleted" });
  } catch (err) {
    console.error("[deleteGroup]", err);
    res.status(500).json({ message: err.message });
  }
};

// ─── Member Management ────────────────────────────────────────────────────────

/**
 * @route POST /api/pms/whatsapp-group/:id/members
 * Adds one member to the ERP group. If the group has a providerGroupId,
 * also attempts to add them to the real WhatsApp group (non-blocking).
 */
const addMember = async (req, res) => {
  try {
    const { error, value } = addMemberSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });

    const group = await WhatsAppProjectGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ message: "Group not found" });

    // Duplicate phone prevention
    const alreadyAdded = group.members.some((m) => m.phone === value.phone);
    if (alreadyAdded) {
      return res.status(409).json({ message: `${value.phone} is already a member of this group` });
    }

    const newMember = {
      ...value,
      addedBy: req.user._id,
      addedAt: new Date(),
    };

    group.members.push(newMember);

    let providerResult = null;

    // Attempt Maytapi sync if the group is linked to a real WA group
    if (group.providerGroupId && value.phone) {
      const settings = await getSettings();
      const config   = getProviderConfig(settings, settings.activeProvider);
      const provider = require(`../../whatsapp/providers/${settings.activeProvider}.provider`);

      if (typeof provider.addGroupMember === "function") {
        providerResult = await tryProviderOp(() =>
          provider.addGroupMember({ groupId: group.providerGroupId, phone: value.phone, config })
        );

        if (!providerResult.success) {
          group.syncErrors = [providerResult.error];
          group.syncStatus = "partial";
        }
      }
    }

    await group.save();

    logActivity({
      projectId:   group.projectId,
      actorId:     req.user._id,
      entityType:  "whatsapp_group",
      entityId:    group._id,
      action:      "updated",
      description: `Member "${value.name || value.phone}" added to group "${group.groupName}"`,
    });

    res.status(200).json({
      message: "Member added",
      data: {
        group,
        providerSync: providerResult,
      },
    });
  } catch (err) {
    console.error("[addMember]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route DELETE /api/pms/whatsapp-group/:id/members/:phone
 * Phone is URL-encoded (e.g. %2B919617980134 for +919617980134).
 * Removes member from ERP group and, if linked, from the real WA group.
 */
const removeMember = async (req, res) => {
  try {
    const phone = decodeURIComponent(req.params.phone);
    const group = await WhatsAppProjectGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ message: "Group not found" });

    const before = group.members.length;
    group.members = group.members.filter((m) => m.phone !== phone);

    if (group.members.length === before) {
      return res.status(404).json({ message: "Member not found in this group" });
    }

    let providerResult = null;

    // Attempt Maytapi removal if linked
    if (group.providerGroupId) {
      const settings = await getSettings();
      const config   = getProviderConfig(settings, settings.activeProvider);
      const provider = require(`../../whatsapp/providers/${settings.activeProvider}.provider`);

      if (typeof provider.removeGroupMember === "function") {
        providerResult = await tryProviderOp(() =>
          provider.removeGroupMember({ groupId: group.providerGroupId, phone, config })
        );

        if (!providerResult.success) {
          group.syncErrors = [providerResult.error];
          group.syncStatus = "partial";
        }
      }
    }

    await group.save();

    logActivity({
      projectId:   group.projectId,
      actorId:     req.user._id,
      entityType:  "whatsapp_group",
      entityId:    group._id,
      action:      "updated",
      description: `Member "${phone}" removed from group "${group.groupName}"`,
    });

    res.status(200).json({
      message: "Member removed",
      data: { group, providerSync: providerResult },
    });
  } catch (err) {
    console.error("[removeMember]", err);
    res.status(500).json({ message: err.message });
  }
};

// ─── Provider Sync ────────────────────────────────────────────────────────────

/**
 * @route POST /api/pms/whatsapp-group/:id/sync
 * Creates a real WhatsApp group via Maytapi using all members that have phone numbers.
 * If the group already has a providerGroupId, skips group creation and re-syncs members.
 */
const syncWithProvider = async (req, res) => {
  try {
    const group = await WhatsAppProjectGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ message: "Group not found" });

    const settings = await getSettings();
    const config   = getProviderConfig(settings, settings.activeProvider);
    const provider = require(`../../whatsapp/providers/${settings.activeProvider}.provider`);

    if (typeof provider.createGroup !== "function") {
      return res.status(400).json({
        message: `Provider "${settings.activeProvider}" does not support group management`,
      });
    }

    const phonesWithNumbers = group.members
      .map((m) => m.phone)
      .filter(Boolean);

    const membersWithoutPhone = group.members.filter((m) => !m.phone).length;

    // Guard: Maytapi requires at least 1 participant to create a group
    if (phonesWithNumbers.length === 0) {
      return res.status(400).json({
        message: "Cannot create WhatsApp group — no members have phone numbers. Add members with valid phone numbers first.",
        data: {
          membersTotal:    group.members.length,
          membersNoPhone:  group.members.length,
        },
      });
    }

    const syncErrors = [];
    let providerGroupId = group.providerGroupId;

    // Step 1: Create group in WhatsApp if not yet linked
    if (!providerGroupId) {
      const createResult = await tryProviderOp(() =>
        provider.createGroup({ name: group.groupName, participants: phonesWithNumbers, config })
      );

      if (!createResult.success) {
        group.syncStatus = "failed";
        group.syncErrors = [createResult.error];
        await group.save();
        return res.status(502).json({ message: "Failed to create group in WhatsApp", error: createResult.error });
      }

      providerGroupId = createResult.result.groupId;
      group.providerGroupId = providerGroupId;
    } else {
      // Group already exists — add any members not yet in WA group
      for (const phone of phonesWithNumbers) {
        const addResult = await tryProviderOp(() =>
          provider.addGroupMember({ groupId: providerGroupId, phone, config })
        );
        if (!addResult.success) {
          syncErrors.push(`${phone}: ${addResult.error}`);
        }
      }
    }

    group.syncStatus = syncErrors.length === 0 ? "synced" : "partial";
    group.syncedAt   = new Date();
    group.syncErrors = syncErrors;
    await group.save();

    logActivity({
      projectId:   group.projectId,
      actorId:     req.user._id,
      entityType:  "whatsapp_group",
      entityId:    group._id,
      action:      "updated",
      description: `Group "${group.groupName}" synced with WhatsApp (${phonesWithNumbers.length} members, ${syncErrors.length} errors)`,
    });

    res.status(200).json({
      message: group.syncStatus === "synced" ? "Group synced successfully" : "Group partially synced",
      data: {
        providerGroupId,
        syncStatus:          group.syncStatus,
        syncedMembers:       phonesWithNumbers.length,
        skippedNoPhone:      membersWithoutPhone,
        errors:              syncErrors,
      },
    });
  } catch (err) {
    console.error("[syncWithProvider]", err);
    res.status(500).json({ message: err.message });
  }
};

// ─── Broadcast ────────────────────────────────────────────────────────────────

/**
 * @route POST /api/pms/whatsapp-group/send/:id
 * Sends a WhatsApp message to all members of the group.
 */
const sendGroupUpdate = async (req, res) => {
  try {
    const { error, value } = sendUpdateSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });

    const group = await WhatsAppProjectGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (!group.members || group.members.length === 0) {
      return res.status(400).json({ message: "Group has no members to send to" });
    }

    const results = [];
    for (const member of group.members) {
      if (!member.phone) {
        results.push({ phone: null, name: member.name, success: false, error: "No phone number" });
        continue;
      }
      try {
        const result = await sendImmediate({
          to:                member.phone,
          message:           value.message,
          templateId:        value.templateId,
          templateVariables: value.templateVariables,
          mediaUrl:          value.mediaUrl,
          relatedTo:         { module: "pms_whatsapp_group", recordId: group._id },
          createdBy:         req.user._id,
        });
        results.push({ phone: member.phone, name: member.name, success: true, messageId: result.messageId });
      } catch (sendErr) {
        results.push({ phone: member.phone, name: member.name, success: false, error: sendErr.message });
      }
    }

    await WhatsAppProjectGroup.findByIdAndUpdate(req.params.id, {
      $set: { lastMessageAt: new Date() },
      $inc: { messageCount: 1 },
    });

    const delivered = results.filter((r) => r.success).length;

    logActivity({
      projectId:   group.projectId,
      actorId:     req.user._id,
      entityType:  "whatsapp_group",
      entityId:    group._id,
      action:      "updated",
      description: `Message sent to group "${group.groupName}" (${delivered}/${results.length} delivered)`,
    });

    res.status(200).json({ message: "Group update sent", data: { results, delivered, total: results.length } });
  } catch (err) {
    console.error("[sendGroupUpdate]", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createGroup,
  getGroupsByProject,
  getAllGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  addMember,
  removeMember,
  syncWithProvider,
  sendGroupUpdate,
};
