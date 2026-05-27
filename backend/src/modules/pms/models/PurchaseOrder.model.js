const mongoose = require("mongoose");

/**
 * PMS Purchase Order Schema
 * Handles official orders to vendors for AC, Automation, Kitchen, or Materials.
 */
const purchaseOrderSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task", // Link to AC, Automation, or Kitchen task
    },

    // --- Order Info ---
    poNumber: {
      type: String,
      unique: true,
      required: true,
    },
    items: [
      {
        description: String,
        quantity: Number,
        rate: Number,
        amount: Number,
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
    },

    // --- Workflow ---
    status: {
      type: String,
      enum: ["draft", "sent_to_vendor", "confirmed", "delivered", "cancelled"],
      default: "draft",
    },

    // --- Payment Info ---
    paymentStatus: {
      type: String,
      enum: ["unpaid", "partially_paid", "fully_paid"],
      default: "unpaid",
    },
    advancePaid: { type: Number, default: 0 },

    // --- Logistics ---
    expectedDeliveryDate: Date,
    actualDeliveryDate: Date,
    deliveryLocation: String,

    notes: String,
  },
  {
    timestamps: true,
    collection: "pms_purchase_orders",
  }
);

// Auto-generate PO Number
purchaseOrderSchema.pre("validate", async function () {
  if (this.isNew && !this.poNumber) {
    try {
      const PurchaseOrderModel = mongoose.model("PurchaseOrder", purchaseOrderSchema, "pms_purchase_orders");
      const count = await PurchaseOrderModel.countDocuments();
      this.poNumber = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
    } catch (error) {
      console.error("Error generating PO number:", error);
    }
  }
});



module.exports = mongoose.model("PurchaseOrder", purchaseOrderSchema, "pms_purchase_orders");
