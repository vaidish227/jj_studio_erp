const aiConfig = require("../config/aiConfig");

/**
 * Compute USD cost for a single OpenAI call.
 * Pricing table lives in aiConfig.pricing (per 1M tokens).
 */
function computeCost(model, promptTokens = 0, completionTokens = 0) {
  const p = aiConfig.pricing[model];
  if (!p) return 0;
  const inCost  = (Number(promptTokens)     || 0) * (p.input  / 1_000_000);
  const outCost = (Number(completionTokens) || 0) * (p.output / 1_000_000);
  return Number((inCost + outCost).toFixed(6));
}

module.exports = { computeCost };
