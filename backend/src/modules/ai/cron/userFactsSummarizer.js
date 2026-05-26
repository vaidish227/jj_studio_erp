// Nightly summarizer: walks users active in the last 24 hours and distils
// durable facts from their recent conversations into AIUserFact rows.

const cron = require("node-cron");
const userFactsService = require("../services/userFacts.service");
const aiConfig = require("../config/aiConfig");

let task = null;

function startUserFactsSummarizer() {
  if (task) return; // idempotent — guards against duplicate scheduling
  if (!aiConfig.openai.apiKey) {
    console.log("[AI][userFacts cron] OPENAI_API_KEY not set — summarizer disabled.");
    return;
  }
  // Daily at 03:15 local time. Slightly off-the-hour to avoid colliding with
  // other cron jobs.
  task = cron.schedule("15 3 * * *", async () => {
    const start = Date.now();
    try {
      const result = await userFactsService.summarizeAllRecentUsers();
      console.log(
        `[AI][userFacts cron] done in ${Date.now() - start}ms — ` +
        `users=${result?.totalUsers ?? 0}, facts=${result?.totalFacts ?? 0}`
      );
    } catch (err) {
      console.error("[AI][userFacts cron] failed:", err.message);
    }
  });
  console.log("[AI][userFacts cron] scheduled — runs daily at 03:15");
}

module.exports = { startUserFactsSummarizer };
