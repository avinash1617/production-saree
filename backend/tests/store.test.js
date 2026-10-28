const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calculateShipping,
  fulfillmentTransitions,
  normalizeItems,
  validateCustomer,
} = require("../routes/orders");
const { validateProductInput } = require("../services/products");
const app = require("../server");

test("product validation stores INR amounts as integer paise", () => {
  const product = validateProductInput({
    name: "Kanjivaram",
    description: "Handwoven silk saree",
    category: "Sarees",
    fabric: "Silk",
    price: 1250.75,
    imageUrl: "https://images.example.test/kanjivaram.jpg",
    stock: 3,
    isNew: true,
  });
  assert.equal(product.pricePaise, 125075);
  assert.equal(product.stock, 3);
  assert.equal(product.newArrival, true);
  assert.equal(product.active, true);
});

test("product validation rejects insecure images, unknown categories, and fractional stock", () => {
  const input = {
    name: "Saree",
    description: "Description",
    category: "Sarees",
    price: 100,
    imageUrl: "http://images.example.test/saree.jpg",
    stock: 1,
  };
  assert.throws(() => validateProductInput(input), /HTTPS/);
  assert.throws(() => validateProductInput({ ...input, imageUrl: "https://images.example.test/a.jpg", category: "Unknown" }), /category/);
  assert.throws(() => validateProductInput({ ...input, imageUrl: "https://images.example.test/a.jpg", stock: 1.5 }), /whole number/);
  assert.throws(() => validateProductInput({ ...input, imageUrl: "https://images.example.test/a.jpg", stock: null }), /whole number/);
});

test("shipping is charged below the configured free-shipping threshold", () => {
  assert.equal(calculateShipping(199899), 9900);
  assert.equal(calculateShipping(199900), 0);
});

test("checkout item validation rejects forged product IDs and excessive quantities", () => {
  assert.throws(() => normalizeItems([{ productId: "not-an-id", quantity: 1 }]), /invalid/);
  assert.throws(() => normalizeItems([{ productId: "0123456789abcdef01234567", quantity: 11 }]), /quantity/);
  assert.deepEqual(normalizeItems([
    { productId: "0123456789abcdef01234567", quantity: 2 },
    { productId: "0123456789abcdef01234567", quantity: 3 },
  ]), [{ productId: "0123456789abcdef01234567", quantity: 5 }]);
});

test("guest delivery details require a valid Indian address and normalize email", () => {
  const customer = validateCustomer({
    name: "A Customer",
    email: "CUSTOMER@example.com",
    phone: "98765 43210",
    addressLine: "12 Example Street",
    city: "Chennai",
    state: "Tamil Nadu",
    postalCode: "600001",
  });

  assert.equal(customer.email, "customer@example.com");
  assert.equal(customer.phone, "9876543210");
  assert.throws(() => validateCustomer({ ...customer, postalCode: "123" }), /PIN code/);
});

test("order fulfillment moves forward from processing to shipped to delivered", () => {
  assert.deepEqual(fulfillmentTransitions.processing, ["shipped"]);
  assert.deepEqual(fulfillmentTransitions.shipped, ["delivered"]);
  assert.deepEqual(fulfillmentTransitions.delivered, []);
});

test("admin product endpoints reject unauthenticated access", async (context) => {
  const server = app.listen(0);
  context.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/products/admin`);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Admin sign-in required." });

  const invalidCategory = await fetch(`http://127.0.0.1:${port}/api/products?category=Unknown`);
  assert.equal(invalidCategory.status, 400);
  assert.deepEqual(await invalidCategory.json(), { error: "Choose a valid product category." });

  const repeatedFabric = await fetch(`http://127.0.0.1:${port}/api/products?fabric=Cotton&fabric=Silk`);
  assert.equal(repeatedFabric.status, 400);
  assert.deepEqual(await repeatedFabric.json(), { error: "Enter a valid fabric filter." });
});
