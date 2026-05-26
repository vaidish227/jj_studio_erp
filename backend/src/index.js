const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const app = require("./app");
const { connectDb } = require("./config/db")

const { startMailQueueProcessor }     = require("./modules/mail/cron/mailQueueProcessor");
const { startWhatsAppQueueProcessor } = require("./modules/whatsapp/cron/whatsappQueueProcessor");
const { startUserFactsSummarizer }    = require("./modules/ai/cron/userFactsSummarizer");

connectDb();

// Start communication queue processors
startMailQueueProcessor();
startWhatsAppQueueProcessor();

// Start AI long-term memory nightly summarizer
startUserFactsSummarizer();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});