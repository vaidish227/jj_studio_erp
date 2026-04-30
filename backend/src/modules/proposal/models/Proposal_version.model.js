const mongoose = require("mongoose");
const proposalVersionSchema = new mongoose.Schema(
    {
        proposalId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Proposal",
            required: true,
        },

        version: {
            type: Number,
            required: true,
        },

        snapshot: {
            type: Object, // full proposal copy
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("ProposalVersion", proposalVersionSchema);