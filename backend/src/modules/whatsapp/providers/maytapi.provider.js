const axios = require("axios");

// Normalize to E.164-style: strip formatting, ensure leading +
// Throws if the digit count is < 11 (i.e. missing country code, e.g. bare 10-digit Indian number)
const normalizePhone = (raw) => {
  const cleaned = raw.replace(/[\s\-().]/g, "");
  const withPlus = cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
  const digits = withPlus.replace(/\D/g, "");
  if (digits.length < 11) {
    throw new Error(
      `Phone number "${raw}" is missing the country code. Use international format, e.g. +91 9617980134`
    );
  }
  return withPlus;
};

const buildHeaders = (token) => ({
  "x-maytapi-key": token,
  "Content-Type": "application/json",
});

const getCredentials = (config = {}) => {
  const productId = config.productId || process.env.MAYTAPI_PRODUCT_ID;
  const phoneId   = config.phoneId   || process.env.MAYTAPI_PHONE_ID;
  const token     = config.token     || process.env.WHATSAPP_TOKEN;
  if (!productId || !phoneId || !token) {
    throw new Error("MayTAPI credentials missing. Set MAYTAPI_PRODUCT_ID, MAYTAPI_PHONE_ID, WHATSAPP_TOKEN.");
  }
  return { productId, phoneId, token };
};

// ─── Message Send ─────────────────────────────────────────────────────────────

const send = async ({ to, message, mediaUrl, mediaType = "none", config = {} }) => {
  const { productId, phoneId, token } = getCredentials(config);
  const url = `https://api.maytapi.com/api/${productId}/${phoneId}/sendMessage`;

  const payload = { to_number: normalizePhone(to), type: "text", message };

  if (mediaUrl && mediaType !== "none") {
    payload.type    = mediaType;
    payload.message = mediaUrl;
    payload.text    = message;
  }

  const response = await axios.post(url, payload, {
    headers: buildHeaders(token),
    timeout: 10000,
  });

  console.log("[maytapi] send response:", JSON.stringify(response.data));

  if (response.data?.success === false) {
    throw new Error(response.data?.message || "Maytapi rejected the message");
  }

  return { messageId: response.data?.data?.msgId || null, provider: "maytapi" };
};

// ─── Group Management ─────────────────────────────────────────────────────────

/**
 * Creates a new WhatsApp group via Maytapi.
 * @param {string} name - Group display name
 * @param {string[]} participants - Array of phone numbers in E.164 format
 * @param {object} config - Optional provider config overrides
 * @returns {{ groupId, inviteLink }}
 */
const createGroup = async ({ name, participants = [], config = {} }) => {
  const { productId, phoneId, token } = getCredentials(config);
  const url = `https://api.maytapi.com/api/${productId}/${phoneId}/createGroup`;

  const normalizedParticipants = participants
    .map((p) => {
      try { return normalizePhone(p).replace("+", ""); }
      catch (e) {
        console.warn(`[maytapi] createGroup — skipping invalid phone "${p}": ${e.message}`);
        return null;
      }
    })
    .filter(Boolean);

  if (normalizedParticipants.length === 0) {
    throw new Error(
      "Cannot create WhatsApp group without participants. Add at least one member with a valid phone number first."
    );
  }

  const payload = { name, numbers: normalizedParticipants };
  console.log("[maytapi] createGroup request →", { url, name, participantCount: normalizedParticipants.length, numbers: normalizedParticipants });

  const response = await axios.post(url, payload, {
    headers: buildHeaders(token),
    timeout: 15000,
  });

  console.log("[maytapi] createGroup response ←", JSON.stringify(response.data));

  if (response.data?.success === false) {
    throw new Error(response.data?.message || "Maytapi failed to create group");
  }

  const data = response.data?.data || {};
  return {
    groupId:    data.id || data.groupId || null,
    inviteLink: data.inviteLink || null,
    provider:   "maytapi",
  };
};

/**
 * Adds a single participant to an existing WhatsApp group.
 * @param {string} groupId - Maytapi group ID
 * @param {string} phone   - Phone number in E.164 format
 * @param {object} config  - Optional provider config overrides
 * @returns {{ success, phone }}
 */
const addGroupMember = async ({ groupId, phone, config = {} }) => {
  const { productId, phoneId, token } = getCredentials(config);
  const url = `https://api.maytapi.com/api/${productId}/${phoneId}/addGroupParticipant`;

  const normalizedPhone = normalizePhone(phone).replace("+", "");

  const response = await axios.post(url, { group_id: groupId, number: normalizedPhone }, {
    headers: buildHeaders(token),
    timeout: 10000,
  });

  console.log("[maytapi] addGroupMember response:", JSON.stringify(response.data));

  if (response.data?.success === false) {
    throw new Error(response.data?.message || "Maytapi failed to add group member");
  }

  return { success: true, phone, provider: "maytapi" };
};

/**
 * Removes a participant from a WhatsApp group.
 * @param {string} groupId - Maytapi group ID
 * @param {string} phone   - Phone number in E.164 format
 * @param {object} config  - Optional provider config overrides
 * @returns {{ success, phone }}
 */
const removeGroupMember = async ({ groupId, phone, config = {} }) => {
  const { productId, phoneId, token } = getCredentials(config);
  const url = `https://api.maytapi.com/api/${productId}/${phoneId}/removeGroupParticipant`;

  const normalizedPhone = normalizePhone(phone).replace("+", "");

  const response = await axios.post(url, { group_id: groupId, number: normalizedPhone }, {
    headers: buildHeaders(token),
    timeout: 10000,
  });

  console.log("[maytapi] removeGroupMember response:", JSON.stringify(response.data));

  if (response.data?.success === false) {
    throw new Error(response.data?.message || "Maytapi failed to remove group member");
  }

  return { success: true, phone, provider: "maytapi" };
};

/**
 * Fetches group info (name, members, admins) from Maytapi.
 * @param {string} groupId - Maytapi group ID
 * @param {object} config  - Optional provider config overrides
 * @returns {{ id, name, members[], admins[] }}
 */
const getGroupInfo = async ({ groupId, config = {} }) => {
  const { productId, phoneId, token } = getCredentials(config);
  const url = `https://api.maytapi.com/api/${productId}/${phoneId}/getGroup/${groupId}`;

  const response = await axios.get(url, {
    headers: buildHeaders(token),
    timeout: 10000,
  });

  console.log("[maytapi] getGroupInfo response:", JSON.stringify(response.data));

  if (response.data?.success === false) {
    throw new Error(response.data?.message || "Maytapi failed to fetch group info");
  }

  const data = response.data?.data || {};
  return {
    id:      data.id || groupId,
    name:    data.name || null,
    members: data.participants || [],
    admins:  data.admins || [],
    provider: "maytapi",
  };
};

module.exports = { send, createGroup, addGroupMember, removeGroupMember, getGroupInfo, normalizePhone };
