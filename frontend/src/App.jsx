import { useEffect, useState } from "react";
import "./App.css";
import Home from "./pages/Home.jsx";
import Admin from "./pages/Admin.jsx";
import Navbar from "./components/Navbar.jsx";
import CartDrawer from "./components/CartDrawer.jsx";
import { api } from "./lib/api.js";

const defaultStoreConfig = {
  currency: "INR",
  shippingFeePaise: 9900,
  freeShippingThresholdPaise: 199900,
  razorpayKeyId: "",
};

function readSavedCart() {
  try {
    const saved = JSON.parse(localStorage.getItem("nihira-cart") || "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter((item) =>
      item &&
      typeof item.product?.id === "string" &&
      typeof item.product.name === "string" &&
      Number.isFinite(item.product.price) &&
      typeof item.product.imageUrl === "string" &&
      Number.isInteger(item.product.stock) &&
      Number.isInteger(item.quantity) &&
      item.quantity > 0 &&
      item.quantity <= Math.min(10, item.product.stock),
    );
  } catch (error) {
    console.error("Could not read the saved shopping bag:", error);
    return [];
  }
}

export default function App() {
  const [cart, setCart] = useState(readSavedCart);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("Sarees");
  const [activeFabric, setActiveFabric] = useState("");
  const [storeConfig, setStoreConfig] = useState(defaultStoreConfig);
  const [catalogRefresh, setCatalogRefresh] = useState(0);
  const [cartError, setCartError] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem("nihira-cart", JSON.stringify(cart));
      setCartError("");
    } catch (error) {
      console.error("Could not save the shopping bag:", error);
      setCartError("Your browser could not save the bag between visits.");
    }
  }, [cart]);

  useEffect(() => {
    if (window.location.pathname === "/admin") return;
    api("/store-config")
      .then(setStoreConfig)
      .catch((error) => console.error("Could not load store checkout settings:", error));
  }, []);

  useEffect(() => {
    if (window.location.pathname === "/admin" || !cart.length) return;
    api("/products")
      .then(({ products }) => {
        const currentProducts = new Map(products.map((product) => [product.id, product]));
        if (cart.some((item) => {
          const currentProduct = currentProducts.get(item.product.id);
          return !currentProduct || currentProduct.stock < item.quantity;
        })) {
          setCartError("Some saved bag items were removed or adjusted because availability changed.");
        }
        setCart((items) => items.flatMap((item) => {
          const currentProduct = currentProducts.get(item.product.id);
          if (!currentProduct) return [];
          const quantity = Math.min(item.quantity, currentProduct.stock, 10);
          return quantity > 0 ? [{ product: currentProduct, quantity }] : [];
        }));
      })
      .catch((error) => console.error("Could not refresh saved bag product details:", error));
    // Refresh saved products once when the storefront starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (window.location.pathname === "/admin") return <Admin />;

  function addToCart(product) {
    setCart((items) => {
      const current = items.find((item) => item.product.id === product.id);
      const quantity = current ? current.quantity + 1 : 1;
      if (quantity > Math.min(product.stock, 10)) return items;
      if (current) {
        return items.map((item) =>
          item.product.id === product.id ? { ...item, product, quantity } : item,
        );
      }
      return [...items, { product, quantity }];
    });
    setCartOpen(true);
  }

  function setCartQuantity(productId, quantity) {
    setCart((items) => quantity <= 0
      ? items.filter((item) => item.product.id !== productId)
      : items.map((item) => item.product.id === productId
        ? { ...item, quantity: Math.min(quantity, item.product.stock, 10) }
        : item));
  }

  const bagCount = cart.reduce((total, item) => total + item.quantity, 0);

  return (
    <>
      <div className="announcement">
        <span>Free delivery on orders over ₹1,999</span>
        <span className="announcement-note">Made with love, worn with grace</span>
      </div>
      <Navbar
        bagCount={bagCount}
        onCategorySelect={setActiveCategory}
        onFabricSelect={setActiveFabric}
        onCartOpen={() => setCartOpen(true)}
      />
      {cartError && <p className="cart-storage-warning" role="status">{cartError}</p>}
      <Home
        activeCategory={activeCategory}
        onCategorySelect={setActiveCategory}
        activeFabric={activeFabric}
        onFabricSelect={setActiveFabric}
        onAddToBag={addToCart}
        refreshKey={catalogRefresh}
      />
      <CartDrawer
        items={cart}
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onQuantityChange={setCartQuantity}
        onCheckoutComplete={() => {
          setCart([]);
          setCatalogRefresh((current) => current + 1);
        }}
        storeConfig={storeConfig}
      />
    </>
  );
}
