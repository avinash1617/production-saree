const crypto = require("crypto");
const express = require("express");
const Razorpay = require("razorpay");
const Order = require("../models/Order");
const Product = require("../models/Product");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();
const fulfillmentStatuses = ["processing", "shipped", "delivered", "cancelled"];
const fulfillmentTransitions = {
  processing: ["shipped"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

function getRazorpay() {
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    const error = new Error("Online payments are not configured yet. Contact the store.");
    error.status = 503;
    throw error;
  }
  return new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
}

function calculateShipping(subtotalPaise) {
  const threshold = Number(process.env.FREE_SHIPPING_THRESHOLD_PAISE || 199900);
  const fee = Number(process.env.SHIPPING_FEE_PAISE || 9900);
  return subtotalPaise >= threshold ? 0 : fee;
}

async function releaseInventory(order) {
  const result = await Order.findOneAndUpdate(
    {
      _id: order._id,
      paymentStatus: "pending",
      inventoryReserved: true,
    },
    { $set: { paymentStatus: "failed", inventoryReserved: false } },
    { new: true },
  );
  if (!result) return false;
  await Promise.all(order.items.map(({ productId, quantity }) =>
    Product.updateOne({ _id: productId }, { $inc: { stock: quantity } }),
  ));
  return true;
}

async function releaseExpiredReservations() {
  const expiry = new Date(Date.now() - 30 * 60 * 1000);
  const expired = await Order.find({
    paymentStatus: "pending",
    inventoryReserved: true,
    createdAt: { $lt: expiry },
  }).select("_id");
  await Promise.all(expired.map(async ({ _id }) => {
    const order = await Order.findById(_id);
    if (order) await releaseInventory(order);
  }));
}

async function markPaymentPaid(razorpayOrderId, paymentId) {
  const order = await Order.findOneAndUpdate(
    { razorpayOrderId, paymentStatus: "pending" },
    {
      $set: {
        paymentStatus: "paid",
        fulfillmentStatus: "processing",
        razorpayPaymentId: paymentId,
        inventoryReserved: false,
      },
    },
    { new: true },
  );
  if (order) return order;
  const existing = await Order.findOne({ razorpayOrderId });
  if (!existing) return null;
  if (existing.paymentStatus === "failed") {
    const latePayment = await Order.findOneAndUpdate(
      { _id: existing._id, paymentStatus: "failed" },
      { $set: { paymentStatus: "refund_pending", razorpayPaymentId: paymentId } },
      { new: true },
    );
    if (latePayment) return latePayment;
  }
  return Order.findOne({
    razorpayOrderId,
    paymentStatus: { $in: ["paid", "refund_pending", "refunded"] },
  });
}

router.post("/", async (req, res, next) => {
  const reserved = [];
  try {
    await releaseExpiredReservations();
    const customer = validateCustomer(req.body?.customer);
    const requestedItems = normalizeItems(req.body?.items);
    const productIds = requestedItems.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds }, active: true }).lean();
    const productMap = new Map(products.map((product) => [String(product._id), product]));
    const orderItems = requestedItems.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) throw httpError(400, "A product in your bag is no longer available.");
      return {
        productId: product._id,
        name: product.name,
        imageUrl: product.imageUrl,
        pricePaise: product.pricePaise,
        quantity: item.quantity,
      };
    });
    const subtotalPaise = orderItems.reduce(
      (total, item) => total + item.pricePaise * item.quantity,
      0,
    );
    const shippingPaise = calculateShipping(subtotalPaise);
    const totalPaise = subtotalPaise + shippingPaise;

    for (const item of orderItems) {
      const update = await Product.updateOne(
        { _id: item.productId, active: true, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
      );
      if (update.modifiedCount !== 1) {
        throw httpError(409, `${item.name} has just sold out or has insufficient stock.`);
      }
      reserved.push(item);
    }

    const razorpay = getRazorpay();
    const providerOrder = await razorpay.orders.create({
      amount: totalPaise,
      currency: "INR",
      receipt: `nl_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`,
      notes: { customerEmail: customer.email },
    });
    const order = await Order.create({
      items: orderItems,
      customer,
      subtotalPaise,
      shippingPaise,
      totalPaise,
      razorpayOrderId: providerOrder.id,
      inventoryReserved: true,
    });

    res.status(201).json({
      orderId: order.id,
      amount: providerOrder.amount,
      currency: providerOrder.currency,
      razorpayOrderId: providerOrder.id,
      keyId: process.env.RAZORPAY_KEY_ID,
      shippingPaise,
      subtotalPaise,
      totalPaise,
    });
  } catch (error) {
    try {
      await restoreReservedStock(reserved);
    } catch (restoreError) {
      console.error("Could not restore stock after checkout failed:", restoreError);
      return next(restoreError);
    }
    next(error);
  }
});

router.post("/verify-payment", async (req, res, next) => {
  try {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } =
      req.body || {};
    if (![orderId, paymentId, signature].every((value) => typeof value === "string" && value.length < 256)) {
      return res.status(400).json({ error: "Payment verification details are invalid." });
    }

    const order = await Order.findOne({ razorpayOrderId: orderId });
    if (!order) return res.status(404).json({ error: "Order not found." });
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest();
    const provided = Buffer.from(signature, "hex");
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
      return res.status(400).json({ error: "Payment verification failed." });
    }

    const paidOrder = await markPaymentPaid(orderId, paymentId);
    if (!paidOrder) return res.status(409).json({ error: "Order payment could not be confirmed." });
    res.json({ orderId: paidOrder.id, paymentStatus: paidOrder.paymentStatus });
  } catch (error) {
    next(error);
  }
});

router.get("/admin", requireAdmin, async (req, res, next) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).limit(200).lean();
    res.json({
      orders: orders.map((order) => ({
        id: String(order._id),
        items: order.items,
        customer: order.customer,
        subtotalPaise: order.subtotalPaise,
        shippingPaise: order.shippingPaise,
        totalPaise: order.totalPaise,
        paymentStatus: order.paymentStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        createdAt: order.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/admin/:id/fulfillment", requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!fulfillmentStatuses.includes(status)) {
      return res.status(400).json({ error: "Choose a valid fulfillment status." });
    }
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found." });
    if (status !== "cancelled" && order.paymentStatus !== "paid") {
      return res.status(409).json({ error: "Only paid orders can be fulfilled." });
    }
    if (status === "cancelled" && order.paymentStatus === "paid") {
      return res.status(409).json({ error: "Refund the payment before cancelling a paid order." });
    }
    if (status !== order.fulfillmentStatus &&
        !fulfillmentTransitions[order.fulfillmentStatus]?.includes(status) &&
        status !== "cancelled") {
      return res.status(409).json({ error: "That fulfillment status transition is not allowed." });
    }
    order.fulfillmentStatus = status;
    await order.save();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

async function handleWebhook(req, res, next) {
  try {
    const signature = req.get("x-razorpay-signature");
    if (!signature || !process.env.RAZORPAY_WEBHOOK_SECRET) {
      return res.status(400).json({ error: "Webhook signature configuration is missing." });
    }
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(req.body)
      .digest();
    const provided = Buffer.from(signature, "hex");
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
      return res.status(400).json({ error: "Webhook signature is invalid." });
    }

    const event = JSON.parse(req.body.toString("utf8"));
    if (event.event === "payment.captured") {
      const payment = event.payload?.payment?.entity;
      if (payment?.order_id && payment?.id) {
        const order = await Order.findOne({ razorpayOrderId: payment.order_id });
        if (!order || payment.amount !== order.totalPaise || payment.currency !== "INR") {
          return res.status(400).json({ error: "Captured payment does not match the store order." });
        }
        await markPaymentPaid(payment.order_id, payment.id);
      }
    }
    res.json({ received: true });
  } catch (error) {
    if (error instanceof SyntaxError) return res.status(400).json({ error: "Invalid webhook payload." });
    next(error);
  }
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 20) {
    throw httpError(400, "Your bag must contain between 1 and 20 different products.");
  }
  const normalized = new Map();
  for (const item of items) {
    const productId = typeof item?.productId === "string" ? item.productId : "";
    const quantity = Number(item?.quantity);
    if (!/^[a-f\d]{24}$/i.test(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      throw httpError(400, "A product or quantity in your bag is invalid.");
    }
    normalized.set(productId, (normalized.get(productId) || 0) + quantity);
  }
  for (const quantity of normalized.values()) {
    if (quantity > 10) throw httpError(400, "A maximum of 10 of each product can be ordered.");
  }
  return [...normalized].map(([productId, quantity]) => ({ productId, quantity }));
}

function validateCustomer(customer = {}) {
  const fields = ["name", "email", "phone", "addressLine", "city", "state", "postalCode"];
  const result = {};
  for (const field of fields) {
    result[field] = typeof customer[field] === "string" ? customer[field].trim() : "";
  }
  if (result.name.length < 2 || result.name.length > 100) throw httpError(400, "Enter your full name.");
  if (result.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) {
    throw httpError(400, "Enter a valid email address.");
  }
  result.email = result.email.toLowerCase();
  result.phone = result.phone.replace(/[\s()-]/g, "");
  if (!/^(?:\+91)?[6-9]\d{9}$/.test(result.phone)) throw httpError(400, "Enter a valid Indian mobile number.");
  if (result.addressLine.length < 5 || result.addressLine.length > 250) throw httpError(400, "Enter a complete delivery address.");
  if (result.city.length < 2 || result.city.length > 100) throw httpError(400, "Enter your city.");
  if (result.state.length < 2 || result.state.length > 100) throw httpError(400, "Enter your state.");
  if (!/^\d{6}$/.test(result.postalCode)) throw httpError(400, "Enter a valid 6-digit PIN code.");
  return result;
}

async function restoreReservedStock(items) {
  await Promise.all(items.map(({ productId, quantity }) =>
    Product.updateOne({ _id: productId }, { $inc: { stock: quantity } }),
  ));
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = {
  handleWebhook,
  router,
  calculateShipping,
  fulfillmentTransitions,
  normalizeItems,
  releaseExpiredReservations,
  validateCustomer,
};
