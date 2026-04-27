const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
    {
        clientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Client",
            required: true
        },

        proposalId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Proposal"
        },

        name: {
            type: String,
            required: true
        },

        projectType: {
            type: String,
            enum: ["Residential", "Commercial"]
        },

        siteAddress: String,
        city: String,

        area: Number,
        budget: Number,

        status: {
            type: String,
            enum: ["design", "execution", "completed"],
            default: "design"
        },

        // Team
        designer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        supervisor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        startDate: Date,
        endDate: Date,

        notes: String
    },
    { timestamps: true }
);

module.exports = mongoose.model("Project", projectSchema);