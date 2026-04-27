const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema(
    {
        // 🔹 Basic Info
        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            lowercase: true,
            trim: true
        },

        phone: {
            type: String,
            required: true
        },

        // 🔹 Job Info
        role: {
            type: String,
            enum: ["sales", "designer", "supervisor", "accounts", "manager", "admin"],
            required: true
        },

        department: {
            type: String,
            enum: ["sales", "design", "execution", "finance", "management"]
        },

        salary: Number,

        joiningDate: {
            type: Date,
            default: Date.now
        },

        // 🔹 Link with Auth User
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        // 🔹 Status
        isActive: {
            type: Boolean,
            default: true
        },

        // 🔹 Extra (optional)
        address: String,
        notes: String
    },
    { timestamps: true }
);

module.exports = mongoose.model("Employee", employeeSchema);