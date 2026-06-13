// Pulls `<<chips: A | B | C>>` quick-reply markers out of an assistant text
// reply. Returns the cleaned content (with the marker stripped) and a
// suggestions array. The model is instructed via systemPrompt.js to place
// the marker at the end of the message; we tolerate it anywhere.

const CHIP_RE = /<<\s*chips\s*:\s*([^<>\n]+?)\s*>>/i;

function extractChips(text) {
  if (!text || typeof text !== "string") return { content: text || "", suggestions: [] };
  const m = text.match(CHIP_RE);
  if (!m) return { content: text, suggestions: [] };

  const raw = m[1] || "";
  const items = raw
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8) // hard cap so a malformed reply can't flood the UI
    .map((label) => ({ label, value: label }));

  const cleaned = text.replace(CHIP_RE, "").replace(/[ \t]+\n/g, "\n").trim();
  return { content: cleaned, suggestions: items };
}

module.exports = { extractChips, CHIP_RE };
