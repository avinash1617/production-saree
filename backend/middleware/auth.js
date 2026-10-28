const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function requireAdmin(req, res, next) {
  const token = req.cookies?.admin_session;
  if (!token) return res.status(401).json({ error: "Admin sign-in required." });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: "nihira-looms",
      audience: "nihira-looms-admin",
    });
    const user = await User.findById(payload.sub).select("_id role").lean();
    if (!user || user.role !== "admin") {
      return res.status(401).json({ error: "Admin session is no longer valid." });
    }
    req.admin = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Admin session expired. Sign in again." });
    }
    next(error);
  }
}

module.exports = { requireAdmin };
