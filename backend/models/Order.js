const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, required: true },
        name: { type: String, required: true },
        imageUrl: { type: String, required: true },
        pricePaise: { type: Number, required: true },
        quantity: { type: Number, required: true },
      },
    ],
    customer: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      addressLine: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
    },
    subtotalPaise: { type: Number, required: true },
    shippingPaise: { type: Number, required: true },
    totalPaise: { type: Number, required: true },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refund_pending", "refunded"],
      default: "pending",
    },
    fulfillmentStatus: {
      type: String,
      enum: ["unfulfilled", "processing", "shipped", "delivered", "cancelled"],
      default: "unfulfilled",
    },
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String, default: "" },
    inventoryReserved: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Order", orderSchema);
