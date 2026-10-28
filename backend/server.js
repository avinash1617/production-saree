require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const express = require("express");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const mongoose = require("mongoose");
const { rateLimit } = require("express-rate-limit");
const authRoutes = require("./routes/auth");
const { handleWebhook, router: orderRoutes, releaseExpiredReservations } = require("./routes/orders");
const productRoutes = require("./routes/products");

const app = express();
const port = Number(process.env.PORT || 5000);
const allowedOrigins = (process.env.APP_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet());
app.use((req, res, next) => {
  const origin = req.get("origin");
  if (origin && allowedOrigins.includes(origin)) return next();
  if (origin) return res.status(403).json({ error: "Request origin is not allowed." });
  next();
});
app.use(cookieParser());

app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json", limit: "100kb" }),
  handleWebhook,
);
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (req, res) => {
  const database = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.status(database === "connected" ? 200 : 503).json({ status: database });
});
app.get("/api/store-config", (req, res) => {
  res.json({
    currency: "INR",
    shippingFeePaise: Number(process.env.SHIPPING_FEE_PAISE || 9900),
    freeShippingThresholdPaise: Number(process.env.FREE_SHIPPING_THRESHOLD_PAISE || 199900),
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
  });
});

app.use("/api/admin", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Try again in 15 minutes." },
  skip: (req) => req.method !== "POST" || !req.path.endsWith("/login"),
}));
app.use("/api", rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
}));
app.use("/api/admin", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);

app.use((req, res) => res.status(404).json({ error: "API endpoint not found." }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error(error);
  if (error.name === "ValidationError") {
    return res.status(400).json({ error: error.message });
  }
  if (error.name === "CastError") return res.status(400).json({ error: "Invalid resource identifier." });
  if (error.code === 11000) return res.status(409).json({ error: "That resource already exists." });
  res.status(error.status || 500).json({
    error: error.status ? error.message : "Something went wrong. Please try again.",
  });
});

async function start() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || /replace_with/i.test(process.env.JWT_SECRET)) {
    throw new Error("JWT_SECRET must be set to a unique random value of at least 32 characters.");
  }
  await mongoose.connect(process.env.MONGODB_URI);
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`Nihira Looms API listening on port ${port}`);
  });
  const reservationCleanup = setInterval(() => {
    releaseExpiredReservations().catch((error) => console.error("Inventory cleanup failed:", error));
  }, 10 * 60 * 1000);
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      clearInterval(reservationCleanup);
      server.close(async () => {
        await mongoose.disconnect();
        process.exit(0);
      });
    });
  }
}

if (require.main === module) {
  start().catch((error) => {
    console.error(`API startup failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = app;
