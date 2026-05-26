
const axios = require("axios");
const { WHATSAPP_CONFIG } = require("../config/whatsapp.config");

const sendWhatsAppMessage = async (to, message) => {
    try {
        const url = `https://api.maytapi.com/api/${WHATSAPP_CONFIG.productId}/${WHATSAPP_CONFIG.phoneId}/sendMessage`;

        const response = await axios.post(
            url,
            {
                to_number: to,
                type: "text",
                message,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "x-maytapi-key": WHATSAPP_CONFIG.token,
                },
            }
        );

        return response.data;
    } catch (error) {
        console.log(error.response?.data || error.message);
        throw error;
    }
};

module.exports = {
    sendWhatsAppMessage,
};