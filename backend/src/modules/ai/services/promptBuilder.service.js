const { buildSystemPrompt } = require("../prompts/systemPrompt");
const { FEW_SHOT_MESSAGES } = require("../prompts/fewShot");

/**
 * Build the full OpenAI messages array for a turn:
 *   [system, ...fewShot, ...history, { role: 'user', content: newMessage }]
 *
 * The new user message is appended LAST so the model always sees the latest
 * user intent. History is already in chronological order from memory.service.
 */
function buildMessages({
  user,
  today,
  history = [],
  newUserMessage,
  permissionNames = [],
  retrievedChunks = [],
  userFacts = [],
}) {
  const system = buildSystemPrompt({
    user,
    today,
    permissionNames,
    retrievedChunks,
    userFacts,
  });
  return [
    { role: "system", content: system },
    ...FEW_SHOT_MESSAGES,
    ...history,
    { role: "user", content: String(newUserMessage || "") },
  ];
}

/**
 * Pick the model based on a simple heuristic. Cheap & deterministic.
 * V3 will replace with a learned classifier and a response cache.
 */
function pickModel({ message, defaultModel, complexModel }) {
  const m = String(message || "");
  if (m.length > 400) return complexModel;
  if (/\b(summary|summarise|summarize|report|compare|analyse|analyze|breakdown|trend|forecast)\b/i.test(m)) {
    return complexModel;
  }
  if (/\b(कितने|कुल|रिपोर्ट|सारांश|विश्लेषण)\b/.test(m)) return complexModel;
  return defaultModel;
}

module.exports = { buildMessages, pickModel };
