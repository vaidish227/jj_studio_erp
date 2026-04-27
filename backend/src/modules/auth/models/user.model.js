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
        },

        phone: {
            type: String,
            required: false,
        },

        role: {
            type: String,
            enum: ["admin", "sales", "manager", "accounts","designer"],
            default: "sales",
        },
       
},
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("User", userSchema);