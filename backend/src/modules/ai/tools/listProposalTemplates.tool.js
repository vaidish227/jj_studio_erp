// Tool: list available Proposal templates so the AI can show options to the user
// when authoring a new proposal via createAndSendProposal.

const Template = require("../../proposal/models/Template.model");

module.exports = {
  name: "listProposalTemplates",
  permission: "crm.read",
  description:
    "List available proposal templates (Civil, Electrical, Carpentry, etc.) the user can pick when creating a new proposal. Call this BEFORE createAndSendProposal whenever the user wants to send a proposal but hasn't specified which template — present the list and ask. Always mention 'Custom' as an additional option (the user can describe their own line items instead of picking a template).",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      type: {
        type: "string",
        enum: ["residential", "commercial", "all"],
        description: "Filter by project type. Defaults to 'all'.",
      },
    },
    required: [],
  },

  handler: async (args) => {
    const q = {};
    if (args.type && args.type !== "all") q.type = args.type;

    const templates = await Template.find(q)
      .select("_id name type description structure.rows")
      .sort({ name: 1 })
      .lean();

    const items = templates.map((t) => ({
      id: String(t._id),
      name: t.name,
      type: t.type,
      description: t.description || "",
      rowCount: t.structure?.rows?.length || 0,
    }));

    return {
      data: items,
      total: items.length,
      summaryText:
        items.length === 0
          ? "No proposal templates available."
          : `${items.length} proposal template${items.length === 1 ? "" : "s"} available (+ Custom)`,
      uiHint: "proposalTemplateList",
      llmSummary: {
        total: items.length,
        // Always remind the model that "Custom" is an option even though it's
        // not in the DB — createAndSendProposal accepts customTitle + customLineItems.
        note: "In addition to these templates, the user can choose 'Custom' to define their own title and line items.",
        templates: items,
      },
    };
  },
};
