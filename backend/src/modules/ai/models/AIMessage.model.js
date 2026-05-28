const mongoose = require("mongoose");

const aiMessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AIConversation",
      required: true,
      index: true,
    },

    role: {
      type: String,
      enum: ["user", "assistant", "tool", "system"],
      required: true,
    },

    content: { type: String, default: "" },

    // Populated when role === "assistant" and the model requested tool calls.
    // Each entry mirrors the OpenAI tool_call shape.
    toolCalls: [
      {
        id:   { type: String },
        name: { type: String },
        args: { type: mongoose.Schema.Types.Mixed },
      },
    ],

    // Populated when role === "tool" — links back to the assistant tool_call id.
    toolCallId: { type: String, default: null },

    // Structured payload for tool messages that the UI can render
    // (e.g. taskList, taskDetails). Not sent back into OpenAI on subsequent turns.
    uiPayload: { type: mongoose.Schema.Types.Mixed, default: null },
    uiHint:    { type: String, default: null },

    model:            { type: String, default: null },
    promptTokens:     { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    finishReason:     { type: String, default: null },

    // Quick-reply chips the model offers alongside the message.
    // Populated by orchestrator from a `<<chips: A | B | C>>` sentinel in the
    // LLM output. Clicking a chip sends `label` back as a new user message.
    suggestions: [
      {
        label: { type: String, required: true },
        value: { type: String, default: null }, // text sent on click; defaults to label
      },
    ],

    // V2 RAG — sources the model was given alongside this message.
    // Each entry corresponds to a [n] citation marker in `content`.
    citations: [
      {
        n:          { type: Number },                                  // marker index (1-based)
        documentId: { type: mongoose.Schema.Types.ObjectId, ref: "AIDocument" },
        chunkId:    { type: mongoose.Schema.Types.ObjectId, ref: "AIDocumentChunk" },
        title:      { type: String },
        source:     { type: String },
        sourceUrl:  { type: String, default: null },
        score:      { type: Number },
        excerpt:    { type: String, default: "" },
      },
    ],
  },
  { timestamps: true, collection: "ai_messages" }
);

aiMessageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model("AIMessage", aiMessageSchema, "ai_messages");
