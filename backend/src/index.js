const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const app = require("./app");
const { connectDb } = require("./config/db")

const startWhatsappScheduler = require("./modules/whatspp/cron/whatsappScheduler");

connectDb();

// Initialize the cron scheduler
startWhatsappScheduler();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});