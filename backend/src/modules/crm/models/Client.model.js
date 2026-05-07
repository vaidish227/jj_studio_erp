/**
 * @deprecated This model is deprecated. Use CRMClient.model.js instead.
 * The 'clients' collection is now unified into the 'crmclients' collection.
 */
const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema(
  {
    name: String,
    phone: String,
    email: String,
    address: String,
    dob: Date,

    companyName: String,
    officeAddress: String,

    spouse: {
      name: String,
      phone: String,
      email: String,
      dob: Date,
      anniversary: Date,
    },

    children: [
      {
        age: Number,
      },
    ],

    siteAddress: {
      buildingName: String,
      tower: String,
      unit: String,
      floor: String,
      fullAddress: String,
      city: String,
    },

    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Client", clientSchema);