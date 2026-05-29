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

// Prevent two simultaneous creates from picking the same version number (#19).
proposalVersionSchema.index({ proposalId: 1, version: 1 }, { unique: true });

module.exports = mongoose.model("ProposalVersion", proposalVersionSchema);