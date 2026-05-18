const axios = require("axios");

const send = async ({ to, message, mediaUrl, mediaType = "none", config = {} }) => {
  const productId = config.productId || process.env.MAYTAPI_PRODUCT_ID;
  const phoneId   = config.phoneId   || process.env.MAYTAPI_PHONE_ID;
  const token     = config.token     || process.env.WHATSAPP_TOKEN;

  if (!productId || !phoneId || !token) {
    throw new Error("MayTAPI credentials missing. Set MAYTAPI_PRODUCT_ID, MAYTAPI_PHONE_ID, WHATSAPP_TOKEN.");
  }

  const url = `https://api.maytapi.com/api/${productId}/${phoneId}/sendMessage`;

  const payload = { to_number: to, type: "text", message };

  if (mediaUrl && mediaType !== "none") {
    payload.type    = mediaType;
    payload.message = mediaUrl;
    payload.text    = message;
  }

  const response = await axios.post(url, payload, {
    headers: { "x-maytapi-key": token, "Content-Type": "application/json" },
    timeout: 10000,
  });

  return { messageId: response.data?.data?.msgId || null, provider: "maytapi" };
};

module.exports = { send };
