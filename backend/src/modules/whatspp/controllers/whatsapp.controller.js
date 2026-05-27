const { sendWhatsAppMessage } = require("../services/whatsapp.service.js");
const { newLeadTemplate } = require("../utils/whatsappTemplates.js");

const sendLeadMessage = async (req, res) => {
    try {
        const { phone, clientName } = req.body;

        if (!phone || !clientName) {
            return res.status(400).json({
                success: false,
                message: "Phone and clientName are required",
            });
        }

        const message = newLeadTemplate(clientName);

        const data = await sendWhatsAppMessage(phone, message);

        return res.status(200).json({
            success: true,
            message: "WhatsApp message sent successfully",
            data,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

module.exports = { sendLeadMessage }