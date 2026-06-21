const EmailDesign = require("../models/EmailDesign.model");
const KitTemplate = require("../models/KitTemplate.model");
const { KNOWN_BLOCK_KEYS } = require("../../mail/service/emailLayout");
const s3 = require("../../pms/services/s3Storage");

const SIGN_TTL = 7 * 24 * 3600; // SigV4 max

const sign = async (key) => {
  if (!key || !s3.isConfigured()) return null;
  try { return await s3.getSignedDownloadUrl({ key, expiresIn: SIGN_TTL, disposition: "inline" }); }
  catch { return null; }
};

// Re-sign the logo + any image/social-icon keys so the builder/list previews render.
const resignDesign = async (doc) => {
  if (doc.theme && doc.theme.logoKey) {
    const u = await sign(doc.theme.logoKey);
    if (u) doc.theme.logoUrl = u;
  }
  const sections = doc.layout && Array.isArray(doc.layout.sections) ? doc.layout.sections : [];
  for (const sec of sections) {
    if (sec.key === "image" && sec.props && sec.props.key) {
      const u = await sign(sec.props.key);
      if (u) sec.props.url = u;
    }
    if (sec.key === "social" && sec.props && Array.isArray(sec.props.links)) {
      for (const l of sec.props.links) {
        if (l && l.iconKey) { const u = await sign(l.iconKey); if (u) l.iconUrl = u; }
      }
    }
  }
  return doc;
};

// Keep only known block keys; coerce enabled + props into the stored shape.
const sanitizeLayout = (layout) => {
  if (!layout || !Array.isArray(layout.sections)) return { sections: undefined };
  const sections = layout.sections
    .filter((s) => s && KNOWN_BLOCK_KEYS.has(s.key))
    .map((s) => ({ key: s.key, enabled: s.enabled !== false, props: (s.props && typeof s.props === "object") ? s.props : {} }));
  return { sections: sections.length ? sections : undefined };
};

const THEME_STRINGS = ["headerColor", "headerTextColor", "brandText", "logoUrl", "logoKey", "footerText", "bodyTextColor", "accentColor", "bgColor"];
const THEME_BOOLS = ["showHeader", "showFooter"];
const applyTheme = (target, theme) => {
  if (!theme || typeof theme !== "object") return;
  for (const f of THEME_STRINGS) if (theme[f] !== undefined) target[f] = String(theme[f] ?? "");
  for (const f of THEME_BOOLS) if (theme[f] !== undefined) target[f] = !!theme[f];
};

// ─── List ────────────────────────────────────────────────────────────────────
const listDesigns = async (req, res) => {
  try {
    await EmailDesign.getOrSeedDefault(); // never show an empty library; migrate legacy branding
    const docs = await EmailDesign.find().sort({ isDefault: -1, name: 1 });
    const out = [];
    for (const d of docs) out.push(await resignDesign(d.toObject()));
    return res.status(200).json({ success: true, designs: out });
  } catch (err) {
    console.error("[kit.listDesigns]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getDesign = async (req, res) => {
  try {
    const doc = await EmailDesign.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Design not found" });
    return res.status(200).json({ success: true, design: await resignDesign(doc.toObject()) });
  } catch (err) {
    console.error("[kit.getDesign]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const createDesign = async (req, res) => {
  try {
    const { name, theme, layout, isDefault } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: "Design name is required" });
    if (await EmailDesign.findOne({ name: name.trim() })) return res.status(409).json({ success: false, message: "A design with this name already exists" });

    const themeDoc = {};
    applyTheme(themeDoc, theme);
    const count = await EmailDesign.countDocuments();
    const makeDefault = !!isDefault || count === 0; // first design is always default
    if (makeDefault) await EmailDesign.updateMany({}, { $set: { isDefault: false } });

    const doc = await EmailDesign.create({
      name: name.trim(), isDefault: makeDefault, theme: themeDoc,
      layout: sanitizeLayout(layout), createdBy: req.user?._id || req.user?.id,
    });
    return res.status(201).json({ success: true, message: "Design created", design: await resignDesign(doc.toObject()) });
  } catch (err) {
    console.error("[kit.createDesign]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const updateDesign = async (req, res) => {
  try {
    const { name, theme, layout, isDefault } = req.body;
    const doc = await EmailDesign.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Design not found" });

    if (name && name.trim()) {
      const clash = await EmailDesign.findOne({ name: name.trim(), _id: { $ne: doc._id } });
      if (clash) return res.status(409).json({ success: false, message: "A design with this name already exists" });
      doc.name = name.trim();
    }
    if (theme !== undefined) { applyTheme(doc.theme, theme); doc.markModified("theme"); }
    if (layout !== undefined) { doc.layout = sanitizeLayout(layout); doc.markModified("layout"); }
    if (isDefault === true && !doc.isDefault) {
      await EmailDesign.updateMany({ _id: { $ne: doc._id } }, { $set: { isDefault: false } });
      doc.isDefault = true;
    }
    await doc.save();
    return res.status(200).json({ success: true, message: "Design saved", design: await resignDesign(doc.toObject()) });
  } catch (err) {
    console.error("[kit.updateDesign]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const setDefault = async (req, res) => {
  try {
    const doc = await EmailDesign.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Design not found" });
    await EmailDesign.updateMany({ _id: { $ne: doc._id } }, { $set: { isDefault: false } });
    doc.isDefault = true;
    await doc.save();
    return res.status(200).json({ success: true, message: `"${doc.name}" is now the default` });
  } catch (err) {
    console.error("[kit.setDefault]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const duplicateDesign = async (req, res) => {
  try {
    const src = await EmailDesign.findById(req.params.id).lean();
    if (!src) return res.status(404).json({ success: false, message: "Design not found" });
    let name = `${src.name} (copy)`;
    for (let i = 2; await EmailDesign.findOne({ name }); i++) name = `${src.name} (copy ${i})`;
    const doc = await EmailDesign.create({
      name, isDefault: false, theme: src.theme, layout: src.layout, createdBy: req.user?._id || req.user?.id,
    });
    return res.status(201).json({ success: true, message: "Design duplicated", design: await resignDesign(doc.toObject()) });
  } catch (err) {
    console.error("[kit.duplicateDesign]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const deleteDesign = async (req, res) => {
  try {
    const doc = await EmailDesign.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Design not found" });
    const total = await EmailDesign.countDocuments();
    if (total <= 1) return res.status(400).json({ success: false, message: "You must keep at least one design" });

    // Templates pointing at this design fall back to the default — clear the link.
    await KitTemplate.updateMany({ designId: doc._id }, { $unset: { designId: "" } });
    const wasDefault = doc.isDefault;
    await doc.deleteOne();
    if (wasDefault) {
      const next = await EmailDesign.findOne().sort({ createdAt: 1 });
      if (next) { next.isDefault = true; await next.save(); }
    }
    return res.status(200).json({ success: true, message: "Design deleted" });
  } catch (err) {
    console.error("[kit.deleteDesign]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { listDesigns, getDesign, createDesign, updateDesign, setDefault, duplicateDesign, deleteDesign };
