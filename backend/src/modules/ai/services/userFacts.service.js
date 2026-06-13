// Long-term user-facts service. Two responsibilities:
//   1. Read: load the most relevant facts for a user (used by memory/orchestrator).
//   2. Write: nightly summarizer that distils repeating patterns from a
//      user's recent conversations into short factual lines.
//
// We deliberately keep facts SHORT (max 500 chars) and FEW per user — the
// goal is to nudge the model's framing, not to encode a profile.

const AIUserFact = require("../models/AIUserFact.model");
const AIMessage = require("../models/AIMessage.model");
const AIConversation = require("../models/AIConversation.model");
const aiConfig = require("../config/aiConfig");
const openai = require("./openai.service");
const { sanitize } = require("../utils/sanitize");
const { count: countTokens } = require("../utils/tokenizer");

const MAX_FACTS_PER_USER = 20;
const FACT_TOKEN_BUDGET = 500;

async function loadFactsForUser(userId, { budget = FACT_TOKEN_BUDGET } = {}) {
  if (!userId) return [];
  const facts = await AIUserFact.find({ userId })
    .sort({ source: 1, createdAt: -1 }) // explicit before summarized
    .limit(MAX_FACTS_PER_USER)
    .select("fact source confidence")
    .lean();

  // Fit into budget
  const kept = [];
  let used = 0;
  for (const f of facts) {
    const t = countTokens(f.fact);
    if (used + t > budget) break;
    kept.push(f);
    used += t;
  }
  return kept;
}

async function addExplicitFact({ userId, fact }) {
  if (!userId || !fact?.trim()) return null;
  const clean = sanitize(fact, { stringCap: 500 }).trim();
  return AIUserFact.findOneAndUpdate(
    { userId, fact: clean },
    { $set: { source: "explicit", confidence: 1, expiresAt: null } },
    { upsert: true, new: true }
  );
}

async function removeFact({ userId, factId }) {
  return AIUserFact.deleteOne({ _id: factId, userId });
}

/**
 * Summarize a user's recent conversations into 3–7 short facts. Idempotent —
 * uses an upsert on (userId, fact). Drops duplicate near-matches by exact text.
 *
 * @param {string} userId
 * @param {Object=} opts.windowDays  look-back window, default 14
 */
async function summarizeUserFacts(userId, { windowDays = 14 } = {}) {
  if (!aiConfig.openai.apiKey) return { skipped: "ai_not_configured" };

  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const conversations = await AIConversation.find({
    userId,
    lastMessageAt: { $gte: since },
    status: "active",
  })
    .sort({ lastMessageAt: -1 })
    .limit(20)
    .select("_id title")
    .lean();
  if (conversations.length === 0) return { skipped: "no_recent_conversations" };

  const convIds = conversations.map((c) => c._id);
  const messages = await AIMessage.find({
    conversationId: { $in: convIds },
    role: { $in: ["user", "assistant"] },
  })
    .sort({ createdAt: -1 })
    .limit(120)
    .select("role content createdAt")
    .lean();

  if (messages.length < 4) return { skipped: "not_enough_signal" };

  // Build a compact transcript newest-first then reverse for chronological order.
  messages.reverse();
  const transcript = messages
    .map((m) => `[${m.role}] ${String(m.content || "").slice(0, 400)}`)
    .join("\n")
    .slice(0, 6000); // bound prompt size

  const client = openai.getClient();
  const sys = [
    "You distil a user's chat history into a small list of durable facts that will help an ERP assistant respond better next time.",
    "Rules:",
    "- Output 0 to 7 facts as a JSON array of strings, no prose.",
    "- Each fact: ≤ 140 chars, no PII (emails, phones), no quotes around the text.",
    "- Favor durable preferences ('prefers task tables', 'usually asks about residential projects'), workflow habits ('starts day by asking what is pending'), and recurring focus areas ('owns kitchen drawings').",
    "- Skip one-off questions, transient tasks, or anything ID-specific.",
    "- Return [] if there's nothing useful.",
  ].join("\n");

  let raw;
  try {
    const completion = await client.chat.completions.create({
      model: aiConfig.models.default,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: transcript },
      ],
      temperature: 0.1,
      max_tokens: 400,
      response_format: { type: "json_object" },
    });
    raw = completion.choices?.[0]?.message?.content || "";
  } catch (err) {
    return { error: err.message };
  }

  let facts = [];
  try {
    const parsed = JSON.parse(raw);
    facts = Array.isArray(parsed) ? parsed : Array.isArray(parsed.facts) ? parsed.facts : [];
  } catch {
    facts = [];
  }
  facts = facts
    .map((f) => String(f || "").trim())
    .filter((f) => f.length > 8 && f.length <= 200)
    .slice(0, 7);

  let inserted = 0;
  for (const fact of facts) {
    await AIUserFact.findOneAndUpdate(
      { userId, fact },
      {
        $setOnInsert: {
          userId, fact,
          source: "summarized",
          confidence: 0.7,
          // Auto-expire summarized facts in 60 days unless reconfirmed
          expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        },
      },
      { upsert: true, new: false }
    );
    inserted++;
  }

  return { factCount: facts.length, inserted };
}

/**
 * Cron entrypoint — summarize for all active users in a single pass. Run
 * nightly via node-cron in index.js.
 */
async function summarizeAllRecentUsers() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const userIds = await AIConversation.distinct("userId", {
    lastMessageAt: { $gte: since },
    status: "active",
  });
  let totalUsers = 0, totalFacts = 0;
  for (const userId of userIds) {
    try {
      const res = await summarizeUserFacts(userId, { windowDays: 14 });
      if (res?.inserted) {
        totalUsers++;
        totalFacts += res.inserted;
      }
    } catch (err) {
      console.error("[AI][userFacts] summarize failed for", String(userId), err.message);
    }
  }
  return { totalUsers, totalFacts };
}

module.exports = {
  loadFactsForUser,
  addExplicitFact,
  removeFact,
  summarizeUserFacts,
  summarizeAllRecentUsers,
};
