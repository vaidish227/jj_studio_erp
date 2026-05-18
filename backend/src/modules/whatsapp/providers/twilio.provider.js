// Twilio WhatsApp provider — stub for future integration.
// Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM in .env and implement below.

const send = async ({ to, message, mediaUrl, mediaType = "none", config = {} }) => {
  throw new Error(
    "Twilio WhatsApp provider is not yet configured. " +
    "Set activeProvider to 'maytapi' in communication settings, or implement Twilio credentials."
  );
};

module.exports = { send };
