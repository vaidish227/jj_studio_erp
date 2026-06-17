const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        password: {
            type: String,
            required: true,
            minlength: 6,
            // Excluded from query results unless explicitly requested via
            // .select('+password'). Auth flows (loginUser, changePassword)
            // opt in; nothing else can accidentally leak the hash. (NEW-1)
            select: false,
        },

        phone: {
            type: String,
            required: false,
        },

        role: {
            type: String,
            enum: ["admin", "md", "manager", "sales", "accounts", "designer", "supervisor", "vendor", "client", "mis", "marketing", "hr"],
            default: "sales",
        },

        // Per-user permission overrides (added on top of role permissions)
        customPermissions: {
            type: [String],
            default: [],
        },

        isActive: {
            type: Boolean,
            default: true,
        },

        department: {
            type: String,
            trim: true,
        },

        designation: {
            type: String,
            trim: true,
        },

        reportingManager: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

},
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("User", userSchema);