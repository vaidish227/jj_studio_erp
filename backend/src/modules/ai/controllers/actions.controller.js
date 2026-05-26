// Confirm / cancel endpoints for write-tool proposals.
// The AI proposes a write (creates AIToolCall with status='pending_confirmation').
// The user clicks Confirm or Cancel in the chat UI, which hits one of these.

const mongoose = require("mongoose");
const executor = require("../services/tools.executor");

async function confirm(req, res) {
  const id = req.params.toolCallId;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ ok: false, message: "Invalid action id." });
  }
  const result = await executor.confirmAction({
    toolCallId: id,
    ctx: {
      userId: req.user.id,
      role: req.user.role,
      email: req.user.email,
      permissions: req.permissions || [],
    },
  });
  if (!result?.ok) {
    return res.status(httpStatusFor(result?.error)).json(result);
  }
  res.json(result);
}

async function cancel(req, res) {
  const id = req.params.toolCallId;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ ok: false, message: "Invalid action id." });
  }
  const result = await executor.cancelAction({
    toolCallId: id,
    ctx: {
      userId: req.user.id,
      role: req.user.role,
      permissions: req.permissions || [],
    },
  });
  if (!result?.ok) {
    return res.status(httpStatusFor(result?.error)).json(result);
  }
  res.json(result);
}

function httpStatusFor(errCode) {
  switch (errCode) {
    case "not_found":    return 404;
    case "denied":       return 403;
    case "wrong_state":  return 409;
    case "expired":      return 410;
    default:             return 400;
  }
}

module.exports = { confirm, cancel };
