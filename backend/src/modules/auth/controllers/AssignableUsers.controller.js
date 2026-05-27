const User = require("../models/user.model");
const Task = require("../../pms/models/Task.model");

const ASSIGNABLE_ROLES = ["admin", "md", "manager", "designer", "supervisor"];

/**
 * @route GET /api/pms/users/assignable
 * Returns users who can be assigned to tasks/teams, enriched with active task count.
 */
const getAssignableUsers = async (req, res) => {
  try {
    const users = await User.find({ role: { $in: ASSIGNABLE_ROLES } })
      .select("name email role phone")
      .sort({ name: 1 })
      .lean();

    const userIds = users.map((u) => u._id);

    // Aggregate active task counts for workload visibility
    const taskCounts = await Task.aggregate([
      {
        $match: {
          assignedTo: { $in: userIds },
          status: { $nin: ["completed", "cancelled"] },
        },
      },
      { $group: { _id: "$assignedTo", count: { $sum: 1 } } },
    ]);

    const countMap = taskCounts.reduce((acc, t) => {
      acc[t._id.toString()] = t.count;
      return acc;
    }, {});

    const result = users.map((u) => ({
      ...u,
      activeTasks: countMap[u._id.toString()] || 0,
    }));

    res.status(200).json({ users: result });
  } catch (err) {
    console.error("[getAssignableUsers]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route PATCH /api/pms/users/:userId/contact
 * Updates email and/or phone on a user record.
 * Used when assigning a task and the assignee has no email/phone on file.
 */
const updateUserContact = async (req, res) => {
  try {
    const { userId } = req.params;
    const { email, phone } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ message: "Provide at least email or phone to update" });
    }

    const update = {};
    if (email) update.email = email.trim().toLowerCase();
    if (phone) {
      const cleaned = phone.trim().replace(/[\s\-().]/g, "");
      const normalized = cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
      const digits = normalized.replace(/\D/g, "");
      if (digits.length < 11) {
        return res.status(400).json({
          message: `Phone number must include country code (e.g. +91 9876543210). Got: ${phone.trim()}`,
        });
      }
      update.phone = normalized;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: update },
      { new: true, runValidators: true }
    ).select("name email role phone");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "Contact info updated", user });
  } catch (err) {
    console.error("[updateUserContact]", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getAssignableUsers, updateUserContact };
