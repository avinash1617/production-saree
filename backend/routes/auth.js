const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/api",
  maxAge: 4 * 60 * 60 * 1000,
};

router.post("/login", async (req, res, next) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" && Buffer.byteLength(req.body.password, "utf8") <= 72
      ? req.body.password
      : "";
    const user = await User.findOne({ email }).select("+passwordHash");
    const validPassword = user && await bcrypt.compare(password, user.passwordHash);

    if (!validPassword || user.role !== "admin") {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }

    const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: "4h",
      issuer: "nihira-looms",
      audience: "nihira-looms-admin",
    });
    res.cookie("admin_session", token, cookieOptions);
    res.json({ user: { email: user.email, role: user.role } });
  } catch (error) {
    next(error);
  }
});

router.get("/session", requireAdmin, async (req, res, next) => {
  try {
    const user = await User.findById(req.admin._id).select("email role").lean();
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("admin_session", { ...cookieOptions, maxAge: undefined });
  res.json({ success: true });
});

module.exports = router;
