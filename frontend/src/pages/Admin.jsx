import { useEffect, useState } from "react";
import { api, formatPrice } from "../lib/api.js";
import "../styles/Admin.css";

const blankProduct = {
  name: "",
  description: "",
  price: "",
  category: "Sarees",
  fabric: "",
  imageUrl: "",
  stock: 0,
  isNew: false,
  active: true,
};

const productCategories = ["Sarees", "Blouses", "Kurtis & tops", "Dress Materials"];
const fulfillmentTransitions = {
  processing: ["processing", "shipped"],
  shipped: ["shipped", "delivered"],
  delivered: ["delivered"],
};

export default function Admin() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [productForm, setProductForm] = useState(blankProduct);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadDashboard() {
    setError("");
    const [{ products: allProducts }, { orders: allOrders }] = await Promise.all([
      api("/products/admin"),
      api("/orders/admin"),
    ]);
    setProducts(allProducts);
    setOrders(allOrders);
  }

  useEffect(() => {
    let active = true;
    api("/admin/session")
      .then(async ({ user: currentUser }) => {
        if (!active) return;
        setUser(currentUser);
        await loadDashboard();
      })
      .catch((sessionError) => {
        if (sessionError.message !== "Admin sign-in required." &&
            sessionError.message !== "Admin session expired. Sign in again.") {
          setError(sessionError.message);
        }
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => { active = false; };
  }, []);

  async function signIn(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { user: signedInUser } = await api("/admin/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setUser(signedInUser);
      setPassword("");
      await loadDashboard();
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    try {
      await api("/admin/logout", { method: "POST" });
      setUser(null);
      setProducts([]);
      setOrders([]);
      setError("");
    } catch (logoutError) {
      setError(logoutError.message);
    }
  }

  function editProduct(product) {
    setProductForm({
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
      fabric: product.fabric || "",
      imageUrl: product.imageUrl,
      stock: product.stock,
      isNew: product.isNew,
      active: product.active,
    });
    setEditingId(product.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveProduct(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await api(editingId ? `/products/${editingId}` : "/products", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify({
          ...productForm,
          price: Number(productForm.price),
          stock: Number(productForm.stock),
        }),
      });
      setProductForm(blankProduct);
      setEditingId("");
      setNotice(editingId ? "Product updated." : "Product added to the catalog.");
      await loadDashboard();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setLoading(false);
    }
  }

  async function archiveProduct(product) {
    if (!window.confirm(`Remove "${product.name}" from the storefront?`)) return;
    setError("");
    try {
      await api(`/products/${product.id}`, { method: "DELETE" });
      setNotice("Product removed from the storefront.");
      await loadDashboard();
    } catch (archiveError) {
      setError(archiveError.message);
    }
  }

  async function updateFulfillment(orderId, status) {
    setError("");
    try {
      await api(`/orders/admin/${orderId}/fulfillment`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setNotice("Order status updated.");
      await loadDashboard();
    } catch (statusError) {
      setError(statusError.message);
      await loadDashboard();
    }
  }

  if (checking) return <main className="admin-page"><p className="admin-loading">Loading store admin…</p></main>;

  if (!user) {
    return (
      <main className="admin-page admin-login-page">
        <a className="wordmark admin-wordmark" href="/">Nihira<span> Looms</span><small>STORE ADMIN</small></a>
        <form className="admin-login-card" onSubmit={signIn}>
          <p className="eyebrow">Store management</p>
          <h1>Admin sign in</h1>
          <p>Sign in to manage products, stock, and customer orders.</p>
          {error && <p className="admin-error" role="alert">{error}</p>}
          <label>
            Admin email
            <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <button className="button button-dark" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <a className="admin-back-link" href="/">← Back to storefront</a>
        </form>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <a className="wordmark admin-wordmark" href="/">Nihira<span> Looms</span><small>STORE ADMIN</small></a>
        <div className="admin-user">
          <span>{user.email}</span>
          <button type="button" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <div className="admin-content">
        <div className="admin-title-row">
          <div>
            <p className="eyebrow">Nihira Looms</p>
            <h1>Store dashboard</h1>
          </div>
          <button className="admin-refresh" type="button" onClick={() => loadDashboard().catch((loadError) => setError(loadError.message))}>
            Refresh data
          </button>
        </div>

        {error && <p className="admin-error" role="alert">{error}</p>}
        {notice && <p className="admin-notice" role="status">{notice}</p>}

        <section className="admin-panel" aria-labelledby="product-form-title">
          <div className="admin-panel-heading">
            <div>
              <p className="eyebrow">{editingId ? "Update catalog" : "Your catalog"}</p>
              <h2 id="product-form-title">{editingId ? "Edit product" : "Add a product"}</h2>
            </div>
            {editingId && (
              <button className="admin-text-button" type="button" onClick={() => { setEditingId(""); setProductForm(blankProduct); }}>
                Cancel edit
              </button>
            )}
          </div>
          <form className="product-admin-form" onSubmit={saveProduct}>
            <label>
              Product name
              <input value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} required maxLength={120} />
            </label>
            <label>
              Category
              <select value={productForm.category} onChange={(event) => setProductForm({ ...productForm, category: event.target.value })}>
                {productCategories.map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>
            <label>
              Price (₹)
              <input type="number" min="0.01" step="0.01" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} required />
            </label>
            <label>
              Stock
              <input type="number" min="0" step="1" value={productForm.stock} onChange={(event) => setProductForm({ ...productForm, stock: event.target.value })} required />
            </label>
            <label>
              Fabric / product details
              <input value={productForm.fabric} onChange={(event) => setProductForm({ ...productForm, fabric: event.target.value })} maxLength={80} placeholder="e.g. Handwoven Kanjivaram silk" />
            </label>
            <label>
              Product image URL (HTTPS)
              <input type="url" value={productForm.imageUrl} onChange={(event) => setProductForm({ ...productForm, imageUrl: event.target.value })} required placeholder="https://…" />
            </label>
            <label className="admin-field-wide">
              Description
              <textarea value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} required maxLength={2000} rows={3} />
            </label>
            <div className="admin-checks">
              <label><input type="checkbox" checked={productForm.isNew} onChange={(event) => setProductForm({ ...productForm, isNew: event.target.checked })} /> Mark as new arrival</label>
              <label><input type="checkbox" checked={productForm.active} onChange={(event) => setProductForm({ ...productForm, active: event.target.checked })} /> Visible in storefront</label>
            </div>
            <button className="button button-dark admin-save" type="submit" disabled={loading}>
              {loading ? "Saving…" : editingId ? "Save changes" : "Add product"}
            </button>
          </form>
        </section>

        <section className="admin-panel" aria-labelledby="products-title">
          <div className="admin-panel-heading">
            <div>
              <p className="eyebrow">{products.length} catalog items</p>
              <h2 id="products-title">Products & stock</h2>
            </div>
          </div>
          {products.length ? (
            <div className="admin-product-list">
              {products.map((product) => (
                <article className={`admin-product-row${product.active ? "" : " is-archived"}`} key={product.id}>
                  <img src={product.imageUrl} alt="" />
                  <div className="admin-product-details">
                    <h3>{product.name}</h3>
                    <p>{product.category} · Stock: {product.stock} · {formatPrice(Math.round(product.price * 100))}</p>
                    {!product.active && <span className="archived-label">Hidden from storefront</span>}
                  </div>
                  <div className="admin-row-actions">
                    <button className="admin-text-button" type="button" onClick={() => editProduct(product)}>Edit</button>
                    {product.active && <button className="admin-text-button danger-text" type="button" onClick={() => archiveProduct(product)}>Remove</button>}
                  </div>
                </article>
              ))}
            </div>
          ) : <p className="admin-empty">No products yet. Add your first product above.</p>}
        </section>

        <section className="admin-panel" aria-labelledby="orders-title">
          <div className="admin-panel-heading">
            <div>
              <p className="eyebrow">{orders.length} recent orders</p>
              <h2 id="orders-title">Customer orders</h2>
            </div>
          </div>
          {orders.length ? (
            <div className="admin-orders">
              {orders.map((order) => (
                <article className="admin-order" key={order.id}>
                  <div className="order-topline">
                    <div>
                      <strong>Order {order.id.slice(-8).toUpperCase()}</strong>
                      <span>{new Date(order.createdAt).toLocaleString("en-IN")}</span>
                    </div>
                    <strong>{formatPrice(order.totalPaise)}</strong>
                  </div>
                  <div className="order-customer">
                    <strong>{order.customer.name}</strong>
                    <span>{order.customer.phone} · {order.customer.email}</span>
                    <span>{order.customer.addressLine}, {order.customer.city}, {order.customer.state} {order.customer.postalCode}</span>
                  </div>
                  <ul className="order-items">
                    {order.items.map((item) => <li key={item.productId}>{item.name} × {item.quantity}</li>)}
                  </ul>
                  <div className="order-bottomline">
                    <span className={`payment-status status-${order.paymentStatus}`}>Payment: {order.paymentStatus}</span>
                    {order.paymentStatus === "paid" ? (
                      <label className="status-select">
                        Fulfillment
                        <select value={order.fulfillmentStatus} onChange={(event) => updateFulfillment(order.id, event.target.value)}>
                          {(fulfillmentTransitions[order.fulfillmentStatus] || [order.fulfillmentStatus])
                            .map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </label>
                    ) : (
                      <span className="payment-status">Fulfillment: {order.fulfillmentStatus}</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : <p className="admin-empty">Paid orders will appear here.</p>}
        </section>
      </div>
    </main>
  );
}