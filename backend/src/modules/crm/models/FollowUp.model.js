const mongoose = require("mongoose");

const followupSchema = new mongoose.Schema(
    {
        leadId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Lead",
            required: true
        },

        date: {
            type: Date,
            required: true
        },

        note: String,

        nextFollowupDate: Date,

        status: {
            type: String,
            enum: ["pending", "done"],
            default: "pending"
        },

        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Followup", followupSchema);