const allowedCategories = ["Sarees", "Blouses", "Kurtis & tops", "Dress Materials"];

function validateProductInput(body = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) body = {};
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const category = typeof body.category === "string" ? body.category : "";
  const fabric = typeof body.fabric === "string" ? body.fabric.trim() : "";
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  const price = parseNumber(body.price);
  const stock = parseNumber(body.stock);
  let parsedUrl;

  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    throw inputError("Enter a valid product image URL.");
  }

  if (!name || name.length > 120) throw inputError("Product name is required (max 120 characters).");
  if (!description || description.length > 2000) throw inputError("Description is required (max 2,000 characters).");
  if (!allowedCategories.includes(category)) throw inputError("Choose a valid product category.");
  if (!Number.isFinite(price) || price < 0.01 || price > 10000000) throw inputError("Enter a valid price in rupees.");
  if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) throw inputError("Stock must be a non-negative whole number.");
  if (parsedUrl.protocol !== "https:") throw inputError("Image URL must use HTTPS.");

  return {
    name,
    description,
    category,
    fabric,
    imageUrl,
    pricePaise: Math.round(price * 100),
    stock,
    newArrival: body.isNew === true,
    active: body.active !== false,
  };
}

function toProductResponse(product) {
  return {
    id: String(product._id),
    name: product.name,
    description: product.description,
    price: product.pricePaise / 100,
    category: product.category,
    fabric: product.fabric || "",
    imageUrl: product.imageUrl,
    stock: product.stock,
    isNew: product.newArrival,
    active: product.active,
  };
}

function inputError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function parseNumber(value) {
  if (typeof value !== "number" && (typeof value !== "string" || value.trim() === "")) return Number.NaN;
  return Number(value);
}

module.exports = { allowedCategories, toProductResponse, validateProductInput };
