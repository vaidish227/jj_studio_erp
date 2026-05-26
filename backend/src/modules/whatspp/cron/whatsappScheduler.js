const cron = require("node-cron");
const CRMClient = require("../../crm/models/CRMClient.model");
const { sendWhatsAppMessage } = require("../services/whatsapp.service");

// Configure the delay from env variable or default to 120 minutes (2 hours)
const DELAY_MINUTES = parseInt(process.env.WELCOME_WHATSAPP_DELAY_MINUTES) || 120;

const startWhatsappScheduler = () => {
    // Run this cron job every minute
    cron.schedule("* * * * *", async () => {
        try {
            // Calculate the time threshold: 
            // Any lead created BEFORE this time is eligible if they haven't received the message yet.
            const thresholdTime = new Date(Date.now() - DELAY_MINUTES * 60 * 1000);

            // To prevent spamming extremely old leads (e.g. from months ago), 
            // we will only look for leads created within a safe window (e.g., up to 24 hours prior to threshold)
            const safetyCutoffTime = new Date(Date.now() - (DELAY_MINUTES * 60 * 1000) - (24 * 60 * 60 * 1000));

            const pendingLeads = await CRMClient.find({
                createdAt: { $lte: thresholdTime, $gte: safetyCutoffTime },
                whatsappSent: { $ne: true }, // Not sent yet
                phone: { $exists: true, $ne: "" } // Must have a phone number
            });

            for (const lead of pendingLeads) {
                try {
                    const message = `Hello ${lead.name},\n\nThank you for connecting with JJ Studio by Deepa Bagaria.\n\nWe appreciate the opportunity to understand your requirements and look forward to assisting you with your project.\n\nOur team will connect with you shortly.\n\nRegards,\nTeam JJ Studio`;

                    await sendWhatsAppMessage(lead.phone, message);

                    // Update the lead flag and log
                    lead.whatsappSent = true;
                    lead.automation = {
                        ...lead.automation,
                        welcomeWhatsAppSentAt: new Date()
                    };

                    lead.communicationLogs = lead.communicationLogs || [];
                    lead.communicationLogs.push({
                        channel: "WhatsApp",
                        direction: "Outbound",
                        content: message,
                        status: "sent",
                        timestamp: new Date()
                    });

                    await lead.save();
                    console.log(`[WhatsApp Cron] Successfully sent welcome WhatsApp to lead: ${lead._id}`);

                } catch (err) {
                    console.error(`[WhatsApp Cron] Failed to send to lead ${lead._id}:`, err.message);
                }
            }
        } catch (error) {
            console.error("[WhatsApp Cron] Error in cron execution:", error.message);
        }
    });

    console.log(`[WhatsApp Cron] Scheduler initialized. Delay: ${DELAY_MINUTES} minutes.`);
};

module.exports = startWhatsappScheduler;
