const mongoose = require("mongoose");

const categories = ["Sarees", "Blouses", "Kurtis & tops", "Dress Materials"];

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    pricePaise: { type: Number, required: true, min: 1 },
    category: { type: String, required: true, enum: categories },
    fabric: { type: String, trim: true, maxlength: 80, default: "" },
    imageUrl: { type: String, required: true, trim: true, maxlength: 2048 },
    stock: { type: Number, required: true, min: 0, validate: Number.isInteger },
    newArrival: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Product", productSchema);
