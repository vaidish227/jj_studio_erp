const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const app = require("./app");
const { connectDb } = require("./config/db")

const { startMailQueueProcessor }     = require("./modules/mail/cron/mailQueueProcessor");
const { startWhatsAppQueueProcessor } = require("./modules/whatsapp/cron/whatsappQueueProcessor");
const { startUserFactsSummarizer }    = require("./modules/ai/cron/userFactsSummarizer");
const { startPMSReminders }           = require("./modules/pms/cron/pmsReminders");
const { startCampaignScheduler }      = require("./modules/kit/cron/campaignScheduler");
const { logStartupBanner: logVectorIndexBanner } = require("./modules/ai/services/vectorIndex.service");

connectDb();

// Start communication queue processors
startMailQueueProcessor();
startWhatsAppQueueProcessor();

// Start AI long-term memory nightly summarizer
startUserFactsSummarizer();

// Phase 3b — Daily PMS overdue digest + idle gate nudges (06:30 server-local)
startPMSReminders();

// KIT — campaign scheduler: fires due campaign steps every minute
startCampaignScheduler();

// One-shot AI vector-index probe (after a short delay so the Mongo connection
// has settled). Logs a clear warning if the index is missing — V2 RAG depends
// on it.
setTimeout(() => { logVectorIndexBanner().catch(() => {}); }, 4000).unref?.();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});