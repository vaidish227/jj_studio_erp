const Joi = require("joi");
const {
  CHANNELS, TEMPLATE_CATEGORIES, MEDIA_TYPES, ENTITY_TYPES,
} = require("../constants/enums");

const OID = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

// Email design fields — every field optional, blank inherits the global default.
// Shared by per-template overrides (colours/text/logo) and the global-branding
// preview, which also carries the showHeader / showFooter toggles.
const emailDesignSchema = Joi.object({
  headerColor:     Joi.string().allow(""),
  headerTextColor: Joi.string().allow(""),
  brandText:       Joi.string().allow(""),
  logoUrl:         Joi.string().allow(""),
  logoKey:         Joi.string().allow(""),
  footerText:      Joi.string().allow(""),
  bodyTextColor:   Joi.string().allow(""),
  accentColor:     Joi.string().allow(""),
  bgColor:         Joi.string().allow(""),
  showHeader:      Joi.boolean(),
  showFooter:      Joi.boolean(),
});

// Shared field fragments. Channel-conditional requirements are applied per-schema
// so create() can demand them while update() keeps everything optional.
const base = {
  channel:   Joi.string().valid(...CHANNELS),
  name:      Joi.string().min(2).max(120).trim(),
  category:  Joi.string().valid(...TEMPLATE_CATEGORIES).default("custom"),
  subject:   Joi.string().max(500).allow(""),
  htmlBody:  Joi.string().allow(""),
  textBody:  Joi.string().allow(""),
  body:      Joi.string().allow(""),
  title:     Joi.string().max(200).allow(""),
  deepLink:  Joi.string().max(500).allow(""),
  mediaType: Joi.string().valid(...MEDIA_TYPES).default("none"),
  mediaUrl:  Joi.string().uri().allow(""),
  mediaKey:  Joi.string().allow(""),
  attachments: Joi.array().items(Joi.object({
    kind: Joi.string().valid("image", "document", "video").required(),
    url:  Joi.string().uri().allow(""),
    key:  Joi.string().allow(""),
    name: Joi.string().allow(""),
  })),
  emailDesign: emailDesignSchema,
  designId:  OID.allow(null, ""),   // which Email Design (frame) this template wears
  variables: Joi.array().items(Joi.string().trim()),
  isActive:  Joi.boolean(),
};

// On create, the body fields relevant to the chosen channel are required.
const createTemplateSchema = Joi.object({
  ...base,
  channel: base.channel.required(),
  name:    base.name.required(),
  subject:  Joi.when("channel", { is: "email",        then: Joi.string().min(1).max(500).required(),  otherwise: base.subject }),
  htmlBody: Joi.when("channel", { is: "email",        then: Joi.string().min(1).required(),           otherwise: base.htmlBody }),
  body:     Joi.when("channel", { is: Joi.valid("whatsapp", "notification"), then: Joi.string().min(1).required(), otherwise: base.body }),
  title:    Joi.when("channel", { is: "notification", then: Joi.string().min(1).max(200).required(),  otherwise: base.title }),
}).options({ abortEarly: false });

const updateTemplateSchema = Joi.object({ ...base })
  .min(1)
  .options({ abortEarly: false });

// Editable email LAYOUT — an ordered list of blocks. `props` is block-specific
// and intentionally permissive (the renderer reads only the keys it understands).
const emailLayoutSchema = Joi.object({
  sections: Joi.array().items(Joi.object({
    key:     Joi.string().required(),
    enabled: Joi.boolean(),
    props:   Joi.object().unknown(true),
  })),
});

// Render-preview: supply ad-hoc fields and optionally an entity to pull real data.
const previewSchema = Joi.object({
  channel:    base.channel.required(),
  subject:    Joi.string().allow(""),
  htmlBody:   Joi.string().allow(""),
  textBody:   Joi.string().allow(""),
  body:       Joi.string().allow(""),
  title:      Joi.string().allow(""),
  entityType: Joi.string().valid(...ENTITY_TYPES),
  entityId:   OID,
  variables:  Joi.object(),
  emailDesign: emailDesignSchema,
  designId:   OID.allow(null, ""),  // preview a Mail Template through its chosen design
  // Optional draft layout for the live builder preview (overrides the saved one).
  layout:     emailLayoutSchema,
}).options({ abortEarly: false });

module.exports = { createTemplateSchema, updateTemplateSchema, previewSchema };
