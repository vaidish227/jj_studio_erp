const mongoose = require("mongoose");

const aiFeedbackSchema = new mongoose.Schema(
  {
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AIMessage",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    rating: { type: Number, enum: [-1, 1], required: true },
    reason: { type: String, default: "", maxlength: 1000 },
  },
  { timestamps: true, collection: "ai_feedback" }
);

aiFeedbackSchema.index({ messageId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("AIFeedback", aiFeedbackSchema, "ai_feedback");
