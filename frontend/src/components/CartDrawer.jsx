import { useState } from "react";
import { api, formatPrice } from "../lib/api.js";
import "../styles/Cart.css";

const initialCustomer = {
  name: "",
  email: "",
  phone: "",
  addressLine: "",
  city: "",
  state: "",
  postalCode: "",
};

let razorpayScriptPromise;

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = resolve;
      script.onerror = () => {
        razorpayScriptPromise = null;
        reject(new Error("Secure payment checkout could not load. Check your connection and try again."));
      };
      document.body.appendChild(script);
    });
  }
  return razorpayScriptPromise;
}

export default function CartDrawer({
  items,
  open,
  onClose,
  onQuantityChange,
  onCheckoutComplete,
  storeConfig,
}) {
  const [customer, setCustomer] = useState(initialCustomer);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [completeOrderId, setCompleteOrderId] = useState("");
  const [completePaymentStatus, setCompletePaymentStatus] = useState("");

  if (!open) return null;

  const subtotalPaise = items.reduce(
    (total, item) => total + Math.round(item.product.price * 100) * item.quantity,
    0,
  );
  const shippingPaise = subtotalPaise >= storeConfig.freeShippingThresholdPaise
    ? 0
    : storeConfig.shippingFeePaise;
  const totalPaise = subtotalPaise + shippingPaise;

  function updateCustomer(event) {
    const { name, value } = event.target;
    setCustomer((current) => ({ ...current, [name]: value }));
  }

  async function beginCheckout(event) {
    event.preventDefault();
    if (!items.length || busy) return;
    setError("");
    setBusy(true);

    try {
      await loadRazorpay();
      const paymentOrder = await api("/orders", {
        method: "POST",
        body: JSON.stringify({
          customer,
          items: items.map(({ product, quantity }) => ({
            productId: product.id,
            quantity,
          })),
        }),
      });

      const checkout = new window.Razorpay({
        key: paymentOrder.keyId,
        amount: paymentOrder.amount,
        currency: paymentOrder.currency,
        name: "Nihira Looms",
        description: "Your Nihira Looms order",
        order_id: paymentOrder.razorpayOrderId,
        prefill: {
          name: customer.name,
          email: customer.email,
          contact: customer.phone,
        },
        theme: { color: "#59382e" },
        handler: async (response) => {
          try {
            const result = await api("/orders/verify-payment", {
              method: "POST",
              body: JSON.stringify(response),
            });
            setCompleteOrderId(result.orderId);
            setCompletePaymentStatus(result.paymentStatus);
            onCheckoutComplete();
          } catch (verificationError) {
            setError(`${verificationError.message} Contact the store with your payment receipt before retrying.`);
          } finally {
            setBusy(false);
          }
        },
        modal: {
          ondismiss: () => setBusy(false),
        },
      });
      checkout.on("payment.failed", (response) => {
        setError(response.error?.description || "Payment did not complete. Please try again.");
      });
      checkout.open();
    } catch (checkoutError) {
      setError(checkoutError.message);
      setBusy(false);
    }
  }

  function closeDrawer() {
    if (busy) return;
    onClose();
  }

  return (
    <div className="cart-overlay">
      <button className="cart-backdrop" type="button" aria-label="Close shopping bag" onClick={closeDrawer} />
      <section className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <div className="cart-heading">
          <div>
            <p className="eyebrow">Nihira Looms</p>
            <h2 id="cart-title">{completeOrderId ? "Thank you" : "Your bag"}</h2>
          </div>
          <button className="cart-close" type="button" onClick={closeDrawer} aria-label="Close bag">×</button>
        </div>

        {completeOrderId ? (
          <div className="checkout-success" role="status">
            <span className="success-mark" aria-hidden="true">✓</span>
            <h3>{completePaymentStatus === "paid" ? "Your payment is confirmed." : "Your payment needs a store check."}</h3>
            <p>Order reference: <strong>{completeOrderId}</strong></p>
            <p>
              {completePaymentStatus === "paid"
                ? "We’ll prepare your order for delivery. Keep your payment receipt for reference."
                : "Payment was received after the stock reservation expired. Do not pay again; contact the store with this order reference and your Razorpay receipt."}
            </p>
            <button className="button button-dark" type="button" onClick={onClose}>Continue shopping</button>
          </div>
        ) : !items.length ? (
          <div className="empty-cart">
            <p>Your bag is waiting for something lovely.</p>
            <button className="button button-dark" type="button" onClick={onClose}>Continue shopping</button>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {items.map(({ product, quantity }) => (
                <article className="cart-item" key={product.id}>
                  <img src={product.imageUrl} alt="" />
                  <div className="cart-item-copy">
                    <h3>{product.name}</h3>
                    <p>{formatPrice(Math.round(product.price * 100))}</p>
                    <div className="quantity-control" aria-label={`Quantity for ${product.name}`}>
                      <button type="button" aria-label={`Decrease ${product.name} quantity`} onClick={() => onQuantityChange(product.id, quantity - 1)}>−</button>
                      <span>{quantity}</span>
                      <button type="button" aria-label={`Increase ${product.name} quantity`} disabled={quantity >= 10 || quantity >= product.stock} onClick={() => onQuantityChange(product.id, quantity + 1)}>+</button>
                    </div>
                  </div>
                  <button className="remove-item" type="button" aria-label={`Remove ${product.name}`} onClick={() => onQuantityChange(product.id, 0)}>Remove</button>
                </article>
              ))}
            </div>

            <div className="checkout-summary">
              <p><span>Subtotal</span><strong>{formatPrice(subtotalPaise)}</strong></p>
              <p><span>Shipping</span><strong>{shippingPaise ? formatPrice(shippingPaise) : "Free"}</strong></p>
              <p className="checkout-total"><span>Total</span><strong>{formatPrice(totalPaise)}</strong></p>
              {shippingPaise > 0 && (
                <span className="shipping-hint">
                  Add {formatPrice(storeConfig.freeShippingThresholdPaise - subtotalPaise)} for free shipping.
                </span>
              )}
            </div>

            <form className="checkout-form" onSubmit={beginCheckout}>
              <h3>Delivery details</h3>
              <label>
                Full name
                <input name="name" autoComplete="name" value={customer.name} onChange={updateCustomer} required maxLength={100} />
              </label>
              <div className="checkout-fields">
                <label>
                  Email
                  <input name="email" type="email" autoComplete="email" value={customer.email} onChange={updateCustomer} required maxLength={254} />
                </label>
                <label>
                  Mobile
                  <input name="phone" type="tel" autoComplete="tel" inputMode="tel" value={customer.phone} onChange={updateCustomer} required maxLength={16} />
                </label>
              </div>
              <label>
                Address
                <textarea name="addressLine" autoComplete="street-address" value={customer.addressLine} onChange={updateCustomer} required maxLength={250} rows={2} />
              </label>
              <div className="checkout-fields">
                <label>
                  City
                  <input name="city" autoComplete="address-level2" value={customer.city} onChange={updateCustomer} required maxLength={100} />
                </label>
                <label>
                  State
                  <input name="state" autoComplete="address-level1" value={customer.state} onChange={updateCustomer} required maxLength={100} />
                </label>
              </div>
              <label className="postal-field">
                PIN code
                <input name="postalCode" autoComplete="postal-code" inputMode="numeric" pattern="[0-9]{6}" value={customer.postalCode} onChange={updateCustomer} required maxLength={6} />
              </label>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="button button-dark checkout-button" type="submit" disabled={busy || !storeConfig.razorpayKeyId}>
                {busy ? "Preparing secure checkout…" : `Pay securely · ${formatPrice(totalPaise)}`}
              </button>
              {!storeConfig.razorpayKeyId && <p className="form-error">Online checkout is not configured yet.</p>}
              <p className="payment-note">Payments are securely processed by Razorpay.</p>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
