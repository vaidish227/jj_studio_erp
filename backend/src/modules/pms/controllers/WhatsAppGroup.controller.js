const WhatsAppProjectGroup = require("../models/WhatsAppProjectGroup.model");
const { createGroupSchema, updateGroupSchema, sendUpdateSchema } = require("../validator/WhatsAppGroup.validator");
const { logActivity } = require("../../../shared/activityLogger");
const { sendImmediate } = require("../../whatsapp/service/whatsapp.service");

/**
 * @route POST /api/pms/whatsapp-group/create
 */
const createGroup = async (req, res) => {
  try {
    const { error, value } = createGroupSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join('; ') });
    }

    const group = await WhatsAppProjectGroup.create({
      ...value,
      createdBy: req.user._id,
    });

    logActivity({
      projectId:   value.projectId,
      actorId:     req.user._id,
      entityType:  "whatsapp_group",
      entityId:    group._id,
      action:      "created",
      description: `WhatsApp group "${group.groupName}" (${group.groupType}) created`,
    });

    res.status(201).json({ message: "WhatsApp group created", group });
  } catch (error) {
    console.error("[createGroup]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route GET /api/pms/whatsapp-group/project/:projectId
 */
const getGroupsByProject = async (req, res) => {
  try {
    const groups = await WhatsAppProjectGroup.find({ projectId: req.params.projectId })
      .populate("createdBy", "name email")
      .sort({ groupType: 1, createdAt: -1 });

    res.status(200).json({ count: groups.length, groups });
  } catch (error) {
    console.error("[getGroupsByProject]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route PUT /api/pms/whatsapp-group/update/:id
 */
const updateGroup = async (req, res) => {
  try {
    const { error, value } = updateGroupSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join('; ') });
    }

    const group = await WhatsAppProjectGroup.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true }
    );

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    res.status(200).json({ message: "Group updated", group });
  } catch (error) {
    console.error("[updateGroup]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route DELETE /api/pms/whatsapp-group/delete/:id
 */
const deleteGroup = async (req, res) => {
  try {
    const group = await WhatsAppProjectGroup.findByIdAndDelete(req.params.id);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    res.status(200).json({ message: "Group deleted" });
  } catch (error) {
    console.error("[deleteGroup]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route POST /api/pms/whatsapp-group/send/:id
 * Sends a WhatsApp message to all members of the group.
 */
const sendGroupUpdate = async (req, res) => {
  try {
    const { error, value } = sendUpdateSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join('; ') });
    }

    const group = await WhatsAppProjectGroup.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (!group.members || group.members.length === 0) {
      return res.status(400).json({ message: "Group has no members to send to" });
    }

    const results = [];
    for (const member of group.members) {
      try {
        const result = await sendImmediate({
          to:                member.phone,
          message:           value.message,
          templateId:        value.templateId,
          templateVariables: value.templateVariables,
          mediaUrl:          value.mediaUrl,
          relatedTo:         { modelName: "WhatsAppProjectGroup", id: group._id },
          createdBy:         req.user._id,
        });
        results.push({ phone: member.phone, success: true, messageId: result.messageId });
      } catch (sendErr) {
        results.push({ phone: member.phone, success: false, error: sendErr.message });
      }
    }

    // Update message tracking
    await WhatsAppProjectGroup.findByIdAndUpdate(req.params.id, {
      $set:  { lastMessageAt: new Date() },
      $inc:  { messageCount: 1 },
    });

    logActivity({
      projectId:   group.projectId,
      actorId:     req.user._id,
      entityType:  "whatsapp_group",
      entityId:    group._id,
      action:      "updated",
      description: `Message sent to WhatsApp group "${group.groupName}" (${results.filter((r) => r.success).length}/${results.length} delivered)`,
    });

    res.status(200).json({ message: "Group update sent", results });
  } catch (error) {
    console.error("[sendGroupUpdate]", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createGroup,
  getGroupsByProject,
  updateGroup,
  deleteGroup,
  sendGroupUpdate,
};
