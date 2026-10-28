const express = require("express");
const Product = require("../models/Product");
const { requireAdmin } = require("../middleware/auth");
const { allowedCategories, toProductResponse, validateProductInput } = require("../services/products");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const filter = { active: true };
    const category = req.query.category;
    const fabric = req.query.fabric;
    if (category !== undefined) {
      if (typeof category !== "string" ||
          (category !== "New arrivals" && !allowedCategories.includes(category))) {
        return res.status(400).json({ error: "Choose a valid product category." });
      }
      if (category === "New arrivals") filter.newArrival = true;
      else filter.category = category;
    }
    if (fabric !== undefined) {
      if (typeof fabric !== "string" || fabric.length > 80) {
        return res.status(400).json({ error: "Enter a valid fabric filter." });
      }
      filter.fabric = new RegExp(escapeRegex(fabric), "i");
    }

    const products = await Product.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ products: products.map(toProductResponse) });
  } catch (error) {
    next(error);
  }
});

router.get("/admin", requireAdmin, async (req, res, next) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 }).lean();
    res.json({ products: products.map(toProductResponse) });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const input = validateProductInput(req.body);
    const product = await Product.create(input);
    res.status(201).json({ product: toProductResponse(product.toObject()) });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", requireAdmin, async (req, res, next) => {
  try {
    const input = validateProductInput(req.body);
    const product = await Product.findByIdAndUpdate(req.params.id, input, {
      new: true,
      runValidators: true,
    }).lean();
    if (!product) return res.status(404).json({ error: "Product not found." });
    res.json({ product: toProductResponse(product) });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true },
    ).lean();
    if (!product) return res.status(404).json({ error: "Product not found." });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = router;
