// Conversation memory service. V1 is short-term only:
//   - load up to AI_HISTORY_TURNS recent messages from AIMessage
//   - convert them to OpenAI-format messages
//   - fit them to a token budget while preserving tool_call <-> tool pairs

const AIConversation = require("../models/AIConversation.model");
const AIMessage = require("../models/AIMessage.model");
const aiConfig = require("../config/aiConfig");
const { fitHistoryToBudget } = require("../utils/tokenizer");

/**
 * Convert a stored AIMessage doc to the OpenAI chat message shape.
 * Note: `tool` role messages carry the JSON-stringified tool result and a
 * tool_call_id linking back to the assistant's tool_call.
 */
function toOpenAIMessage(doc) {
  if (doc.role === "assistant") {
    const m = { role: "assistant", content: doc.content || "" };
    if (Array.isArray(doc.toolCalls) && doc.toolCalls.length) {
      m.tool_calls = doc.toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: {
          name: tc.name,
          arguments: typeof tc.args === "string" ? tc.args : JSON.stringify(tc.args || {}),
        },
      }));
    }
    return m;
  }
  if (doc.role === "tool") {
    return {
      role: "tool",
      tool_call_id: doc.toolCallId,
      content: doc.content || "",
    };
  }
  // user / system
  return { role: doc.role, content: doc.content || "" };
}

/**
 * Load the recent history for a conversation, return as OpenAI-format messages
 * already trimmed to fit the configured history-budget.
 */
async function loadHistory(conversationId, opts = {}) {
  if (!conversationId) return [];

  const turns = opts.turns ?? aiConfig.limits.historyTurns;
  // budget defaults to aiConfig.budget.history (2500 tokens in V2 — was 4000 in V1)
  const budget = opts.budget ?? aiConfig.budget.history;

  // We load 2x turns to make sure we capture tool messages alongside their
  // parent assistant tool_calls (each turn can contain multiple tool messages).
  const limit = Math.max(2, turns * 4);

  const docs = await AIMessage.find({ conversationId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  // Reverse to chronological order
  docs.reverse();

  const messages = docs.map(toOpenAIMessage);
  return fitHistoryToBudget(messages, budget);
}

async function getOrCreateConversation({ conversationId, userId, firstMessage }) {
  if (conversationId) {
    const conv = await AIConversation.findOne({
      _id: conversationId,
      userId,
      status: { $ne: "deleted" },
    }).lean();
    if (conv) return conv;
  }
  const title = deriveTitle(firstMessage);
  const created = await AIConversation.create({
    userId,
    title,
    startedAt: new Date(),
    lastMessageAt: new Date(),
    messageCount: 0,
  });
  return created.toObject();
}

function deriveTitle(message) {
  if (!message) return "New conversation";
  const cleaned = String(message).replace(/\s+/g, " ").trim();
  if (!cleaned) return "New conversation";
  return cleaned.length > 60 ? cleaned.slice(0, 60) + "…" : cleaned;
}

async function appendMessage(doc) {
  return AIMessage.create(doc);
}

async function bumpConversation(conversationId, { tokens = 0, costUsd = 0, lastMessageAt = new Date(), inc = 1 } = {}) {
  await AIConversation.updateOne(
    { _id: conversationId },
    {
      $inc: { messageCount: inc, totalTokens: tokens, totalCostUsd: costUsd },
      $set: { lastMessageAt },
    }
  );
}

module.exports = {
  loadHistory,
  getOrCreateConversation,
  appendMessage,
  bumpConversation,
  toOpenAIMessage,
  deriveTitle,
};
