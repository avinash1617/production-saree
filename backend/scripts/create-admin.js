require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Set a valid ADMIN_EMAIL in the untracked root .env file.");
  }
  if (!password || password.length < 14 || Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("Set a unique ADMIN_PASSWORD between 14 and 72 bytes in the untracked root .env file.");
  }
  if (!process.env.MONGODB_URI) throw new Error("Set MONGODB_URI in the untracked root .env file.");

  await mongoose.connect(process.env.MONGODB_URI);
  const existing = await User.findOne({ email });
  if (existing) throw new Error("An admin account with that email already exists.");
  await User.create({
    email,
    passwordHash: await bcrypt.hash(password, 12),
    role: "admin",
  });
  console.log(`Created admin account for ${email}. Remove ADMIN_PASSWORD from deployment environment after setup.`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
