const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const connectDb = async () => {
    try {
        const maskedUri = process.env.MONGO_URI ? process.env.MONGO_URI.replace(/:([^:@]+)@/, ':****@') : "UNDEFINED";
        console.log("Connected to:", maskedUri);
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000, 
            family: 4 
        });
        console.log("Connected to MongoDB Atlas");
    } catch (error) {
        console.error("Error connecting to MongoDB:", error.message);
        process.exit(1); 
    }
};

module.exports = { connectDb };