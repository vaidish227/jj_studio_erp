
const templateSchema = new mongoose.Schema(
  {
    name: String,

    type: {
      type: String,
      enum: ["residential", "commercial"],
    },

    description: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Template", templateSchema);