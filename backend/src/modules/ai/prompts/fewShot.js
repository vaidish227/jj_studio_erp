// Optional few-shot exemplars. V1 keeps them empty — GPT-4o-mini handles the
// canonical queries well from the tool descriptions alone, and few-shot adds
// tokens to every request. We keep the file so V3 prompt tuning has a home.

const FEW_SHOT_MESSAGES = [
  // Example shape (do NOT enable in V1):
  // { role: "user", content: "mera pending kya hai?" },
  // { role: "assistant", content: "", tool_calls: [{ id: "x", type: "function", function: { name: "getMyTasks", arguments: '{"status":"pending"}' } }] },
];

module.exports = { FEW_SHOT_MESSAGES };
