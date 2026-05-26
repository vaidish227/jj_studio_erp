// AI module configuration — frozen at module load. Reads from process.env.
// Add new env vars to backend/.env and backend/.env.example.

const toInt = (v, def) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
};
const toFloat = (v, def) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : def;
};

// Per-1M-token USD pricing — keep in sync with OpenAI public pricing.
// Used by cost.service.js to compute AIMetric.costUsd and AIConversation.totalCostUsd.
const PRICING_PER_1M = {
  "gpt-4o-mini":            { input: 0.15,  output: 0.60  },
  "gpt-4o":                 { input: 2.50,  output: 10.00 },
  "text-embedding-3-small": { input: 0.02,  output: 0     },
  "text-embedding-3-large": { input: 0.13,  output: 0     },
};

const aiConfig = Object.freeze({
  openai: {
    apiKey:  process.env.OPENAI_API_KEY || "",
    baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  },

  models: {
    default:   process.env.AI_MODEL_DEFAULT   || "gpt-4o-mini",
    complex:   process.env.AI_MODEL_COMPLEX   || "gpt-4o",
    embedding: process.env.AI_EMBEDDING_MODEL || "text-embedding-3-small",
  },

  limits: {
    maxTokens:        toInt(process.env.AI_MAX_TOKENS, 1500),
    temperature:      toFloat(process.env.AI_TEMPERATURE, 0.2),
    rateLimitPerMin:  toInt(process.env.AI_RATE_LIMIT_PER_MIN, 20),
    historyTurns:     toInt(process.env.AI_HISTORY_TURNS, 10),
    hardTimeoutMs:    toInt(process.env.AI_HARD_TIMEOUT_MS, 60000),
    maxToolIterations: toInt(process.env.AI_MAX_TOOL_ITERATIONS, 5),
    inputCharLimit:   toInt(process.env.AI_INPUT_CHAR_LIMIT, 4000),
  },

  // Token budget for context window assembly (memory.service / promptBuilder).
  // Effective budget is below model max to keep room for completion.
  budget: {
    systemPrompt:    1500,
    toolSchemas:     1000,
    history:         2500,   // V1 was 4000; reduced to make room for RAG context
    retrievedChunks: 3500,
    userFacts:       500,
    responseReserve: 1500,
  },

  pricing: PRICING_PER_1M,

  flags: {
    piiHashMode: String(process.env.AI_PII_HASH_MODE || "false").toLowerCase() === "true",
  },
});

const isConfigured = () => !!aiConfig.openai.apiKey;

module.exports = aiConfig;
module.exports.isConfigured = isConfigured;
